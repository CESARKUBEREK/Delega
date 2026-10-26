// whatsapp-webhook: recibe los WhatsApp de los clientes a través de Twilio
// (?c=<integración>). Se despliega SIN verificación de JWT (Twilio no envía
// uno); en su lugar se exige la firma X-Twilio-Signature, calculada con el
// Auth Token de la cuenta conectada.
//
// Registra el mensaje en la bandeja y lanza las automatizaciones activas con
// disparador "whatsapp_message" (solo las creadas por un owner o admin; como
// mucho 3 por mensaje y 30 ejecuciones por hora). Lo que quieran contestar
// espera la aprobación de una persona.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim, createRun, type RunRow } from "../_shared/agent.ts"
import { isUuid, isWorkspaceAdmin } from "../_shared/core.ts"
import { resolveAi } from "../_shared/llm.ts"
import { recordMessage } from "../_shared/inbox.ts"
import { TRIGGER_TEXT_CHARS } from "../_shared/triggers.ts"
import { parseWhatsAppSecret, phoneOf, validTwilioSignature } from "../_shared/whatsapp.ts"

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const MAX_RUNS_PER_HOUR = 30
const MAX_FLOWS_PER_MESSAGE = 3
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const admin = createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })

type Incoming = { sid: string; phone: string; name: string | null; text: string }

function readMessage(params: URLSearchParams): Incoming | null {
  const sid = params.get("MessageSid") ?? params.get("SmsMessageSid") ?? ""
  const phone = phoneOf(params.get("From"))
  if (!/^(SM|MM)[0-9a-f]{32}$/.test(sid) || !phone) return null
  const parts = [(params.get("Body") ?? "").slice(0, 20_000)]
  const media = Number(params.get("NumMedia") ?? 0)
  if (media > 0) parts.push(media === 1 ? "[archivo adjunto]" : `[${media} archivos adjuntos]`)
  if (params.get("Latitude") && params.get("Longitude")) parts.push(`[ubicación ${params.get("Latitude")}, ${params.get("Longitude")}]`)
  const text = parts.filter(Boolean).join(" ").trim()
  if (!text) return null
  const name = (params.get("ProfileName") ?? "").trim().slice(0, 200) || null
  return { sid, phone, name, text }
}

async function launchFlows(workspaceId: string, msg: Incoming, messageId: number) {
  const { data: flows } = await admin
    .from("flows")
    .select("id, name, definition, created_by, settings")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("definition->trigger->>type", "whatsapp_message")
    .order("created_at")
    .limit(MAX_FLOWS_PER_MESSAGE)
  if (!flows?.length) return

  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("trigger->>type", "whatsapp_message")
    .gte("started_at", new Date(Date.now() - 3_600_000).toISOString())
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
        trigger: { type: "whatsapp_message", phone: msg.phone, name: msg.name, message_id: messageId, text: msg.text.slice(0, TRIGGER_TEXT_CHARS) },
      })
      await admin.from("inbox_messages").update({ run_id: run.id }).eq("id", messageId)
      const claimed: RunRow | null = await claim(admin, run.id, "running")
      if (claimed) await advance(admin, claimed, 60_000)
    } catch (e) {
      console.error("whatsapp-webhook launch", e instanceof Error ? e.name : "error")
    }
  }
}

async function handle(workspaceId: string, integrationId: string, msg: Incoming) {
  const id = await recordMessage(admin, {
    workspaceId,
    integrationId,
    channel: "whatsapp",
    threadExternalId: msg.phone,
    externalId: msg.sid,
    direction: "in",
    senderName: msg.name,
    senderAddress: msg.phone,
    body: msg.text,
    sentAt: new Date().toISOString(),
    contactName: msg.name,
    contactAddress: msg.phone,
  })
  // null: ya estaba registrado (Twilio reintenta si no respondemos a tiempo).
  if (id) await launchFlows(workspaceId, msg, id)
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const search = new URL(req.url).search
  const integrationId = new URLSearchParams(search).get("c")
  if (!isUuid(integrationId)) return new Response("Not found", { status: 404 })

  const { data } = await admin.rpc("integration_secret_by_id", { p_integration_id: integrationId })
  const row = data?.[0] as { workspace_id: string; provider: string; secret: string; status: string } | undefined
  const secret = parseWhatsAppSecret(row?.secret)
  if (!row || row.provider !== "whatsapp" || !secret || row.status !== "active") return new Response("Not found", { status: 404 })

  const raw = await req.text()
  if (raw.length > 200_000) return new Response("Payload too large", { status: 413 })
  const params = new URLSearchParams(raw)

  // La firma se calcula sobre la URL pública que tiene configurada Twilio.
  const url = `${SUPABASE_URL}/functions/v1/whatsapp-webhook${search}`
  const ok = await validTwilioSignature(secret.auth_token, url, [...params.entries()], req.headers.get("x-twilio-signature") ?? "")
  if (!ok) return new Response("Forbidden", { status: 403 })

  // Avisos de estado (enviado, entregado, leído) y mensajes que no son de un cliente: nada que hacer.
  if (params.get("AccountSid") !== secret.account_sid) return new Response("Forbidden", { status: 403 })
  const msg = readMessage(params)
  if (msg) {
    const work = handle(row.workspace_id, integrationId, msg).catch((e) => console.error("whatsapp-webhook", e instanceof Error ? e.name : "error"))
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work)
    else await work
  }
  // Twilio espera TwiML: una respuesta vacía no envía nada al cliente.
  return new Response(EMPTY_TWIML, { status: 200, headers: { "Content-Type": "text/xml" } })
})
