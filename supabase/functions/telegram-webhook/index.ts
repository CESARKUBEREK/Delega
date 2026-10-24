// telegram-webhook: recibe los mensajes del bot de un espacio (?c=<integración>).
// Se despliega SIN verificación de JWT (Telegram no envía uno); en su lugar se
// exige la cabecera X-Telegram-Bot-Api-Secret-Token registrada al conectar.
// Registra el mensaje en la bandeja y lanza los flujos activos con disparador
// "telegram_message". Lo que esos flujos quieran enviar o escribir espera
// la aprobación de una persona.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim, createRun, type RunRow } from "../_shared/agent.ts"
import { isUuid, isWorkspaceAdmin } from "../_shared/core.ts"
import { resolveAi } from "../_shared/llm.ts"
import { recordMessage } from "../_shared/inbox.ts"
import { TRIGGER_TEXT_CHARS } from "../_shared/triggers.ts"
import { parseTelegramSecret, sendTelegram } from "../_shared/telegram.ts"

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const MAX_RUNS_PER_HOUR = 30

function serviceKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // variable heredada
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

type TgUser = { id?: number; first_name?: string; last_name?: string; username?: string; is_bot?: boolean }
type TgChat = { id?: number; type?: string; title?: string; first_name?: string; last_name?: string; username?: string }
type TgMessage = {
  message_id?: number
  date?: number
  chat?: TgChat
  from?: TgUser
  text?: string
  caption?: string
  document?: { file_name?: string }
  photo?: unknown[]
  voice?: unknown
  location?: unknown
}
type Update = { update_id?: number; message?: TgMessage; edited_message?: TgMessage }

function displayName(u: { first_name?: string; last_name?: string; title?: string; username?: string } | undefined): string | null {
  if (!u) return null
  return (u.title ?? [u.first_name, u.last_name].filter(Boolean).join(" ")) || (u.username ? `@${u.username}` : null)
}

function messageText(m: TgMessage): string {
  if (m.text) return m.text
  const parts = [m.caption ?? ""]
  if (m.document) parts.push(`[documento ${m.document.file_name ?? ""}]`)
  if (m.photo) parts.push("[foto]")
  if (m.voice) parts.push("[nota de voz]")
  if (m.location) parts.push("[ubicación]")
  return parts.filter(Boolean).join(" ").trim()
}

async function launchFlows(workspaceId: string, chatId: string, name: string | null, messageId: number, text: string) {
  const { data: flows } = await admin
    .from("flows")
    .select("id, name, definition, created_by, settings")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("definition->trigger->>type", "telegram_message")
    .limit(3)
  if (!flows?.length) return


  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("trigger->>type", "telegram_message")
    .gte("started_at", since)
  let budget = MAX_RUNS_PER_HOUR - (count ?? 0)

  for (const flow of flows) {
    // La bandeja solo la ven los administradores: solo flujos creados por uno.
    if (!(await isWorkspaceAdmin(admin, workspaceId, flow.created_by))) continue
    if (budget-- <= 0) break
    const settings = (flow.settings ?? {}) as { file_ids?: unknown; model?: unknown }
    const conn = await resolveAi(admin, workspaceId, typeof settings.model === "string" ? settings.model : null)
    if (!conn) return
    const fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter(isUuid).slice(0, 5) : []
    try {
      const run = await createRun(admin, {
        workspaceId,
        flow,
        fileIds,
        note: "",
        model: conn.model,
        startedBy: flow.created_by,
        trigger: { type: "telegram_message", chat_id: chatId, name, message_id: messageId, text: text.slice(0, TRIGGER_TEXT_CHARS) },
      })
      await admin.from("inbox_messages").update({ run_id: run.id }).eq("id", messageId)
      const claimed: RunRow | null = await claim(admin, run.id, "running")
      if (claimed) await advance(admin, claimed, 60_000)
    } catch (e) {
      console.error("telegram-webhook launch", e instanceof Error ? e.name : "error")
    }
  }
}

// «/vincular CÓDIGO» (o «/start CÓDIGO» desde un enlace t.me) en un chat
// privado: vincula ese chat a la persona que pidió el código en Orkesta, para
// recibir sus avisos. No se guarda en la bandeja ni lanza flujos.
const LINK_RE = /^\/(?:vincular|start)(?:@\w+)?\s+([A-Za-z0-9]{8})\s*$/

async function handleLink(workspaceId: string, botToken: string, m: TgMessage): Promise<boolean> {
  const match = (m.text ?? "").trim().match(LINK_RE)
  if (!match || m.chat?.type !== "private") return false
  const chatId = String(m.chat.id)
  const { data } = await admin.rpc("telegram_link_complete", {
    p_workspace_id: workspaceId,
    p_code: match[1].toUpperCase(),
    p_chat_id: chatId,
    p_name: displayName(m.from) ?? "",
  })
  const text = data
    ? "Listo: este chat recibirá tus avisos de Orkesta. Puedes desactivarlo en Configuración → Mis avisos."
    : "El código no es válido o ha caducado. Pide uno nuevo en Orkesta (Configuración → Mis avisos)."
  await sendTelegram(botToken, chatId, text).catch(() => undefined)
  return true
}

async function handleUpdate(workspaceId: string, integrationId: string, botToken: string, update: Update) {
  const m = update.message ?? update.edited_message
  if (!m?.chat?.id || !m.message_id || m.from?.is_bot) return
  if (update.message && (await handleLink(workspaceId, botToken, m))) return
  const chatId = String(m.chat.id)
  const text = messageText(m).slice(0, 20_000)
  const chatName = displayName(m.chat)
  const senderName = displayName(m.from)
  const id = await recordMessage(admin, {
    workspaceId,
    integrationId,
    channel: "telegram",
    threadExternalId: chatId,
    externalId: `${chatId}:${m.message_id}${update.edited_message ? `:e${update.update_id ?? ""}` : ""}`,
    direction: "in",
    senderName,
    senderAddress: m.from?.username ? `@${m.from.username}` : null,
    body: update.edited_message ? `(editado) ${text}` : text,
    sentAt: new Date((m.date ?? Date.now() / 1000) * 1000).toISOString(),
    contactName: chatName,
    contactAddress: m.chat.username ? `@${m.chat.username}` : null,
  })
  // Solo los mensajes nuevos (no las ediciones) lanzan flujos.
  if (id && !update.edited_message && text.trim()) await launchFlows(workspaceId, chatId, chatName, id, text)
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const integrationId = new URL(req.url).searchParams.get("c")
  if (!isUuid(integrationId)) return new Response("Not found", { status: 404 })

  const { data } = await admin.rpc("integration_secret_by_id", { p_integration_id: integrationId })
  const row = data?.[0] as { workspace_id: string; provider: string; secret: string; status: string } | undefined
  const secret = parseTelegramSecret(row?.secret)
  if (!row || row.provider !== "telegram" || !secret || row.status !== "active") return new Response("Not found", { status: 404 })

  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? ""
  if (!timingSafeEqual(header, secret.secret_token)) return new Response("Forbidden", { status: 403 })

  const raw = await req.text()
  if (raw.length > 1_000_000) return new Response("Payload too large", { status: 413 })
  let update: Update
  try {
    update = JSON.parse(raw)
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  // Telegram espera una respuesta rápida: el trabajo sigue en segundo plano.
  const work = handleUpdate(row.workspace_id, integrationId, secret.bot_token, update).catch((e) =>
    console.error("telegram-webhook", e instanceof Error ? e.name : "error")
  )
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work)
  else await work
  return new Response("ok", { status: 200 })
})
