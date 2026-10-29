// Mensajes de MarchaSolo al chat privado de Telegram de cada persona (el que
// vinculó con «/vincular CÓDIGO»):
//
// - Aprobaciones: cuando una ejecución espera aprobación, se envía el detalle
//   con dos botones (Aprobar / Rechazar). El botón lleva el id de la ejecución
//   y una huella de la acción concreta, así que un botón antiguo nunca aprueba
//   otra acción posterior de la misma ejecución. Caduca a las 24 h.
// - Respuestas: lo que pidió por Telegram (trigger "telegram_chat") vuelve al
//   mismo chat al terminar.
//
// Solo importa tipos de agent.ts (sin dependencia circular en ejecución).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import type { PendingAction, RunTrigger } from "./agent.ts"
import { type InlineKeyboard, parseTelegramSecret, sendTelegram, setWebhook, WEBHOOK_VERSION } from "./telegram.ts"

type RunInfo = { id: string; workspace_id: string; flow_name: string; started_by: string | null; trigger: RunTrigger }

export const APPROVAL_TTL_MS = 24 * 3_600_000

// Acciones que se pueden aprobar desde Telegram. Sobrescribir celdas de una
// planilla (update_range) borra datos: solo desde la app.
const TELEGRAM_APPROVABLE = new Set<PendingAction["tool"]>([
  "append_rows",
  "append_to_document",
  "create_document",
  "send_email",
  "send_telegram",
  "send_whatsapp",
  "save_file",
  "create_event",
  "update_event",
  "crm_create",
  "crm_update",
  "crm_note",
  "crm_task",
  "tokko_lead",
  "buffer_post",
])

export function approvableFromTelegram(tool: string): boolean {
  return TELEGRAM_APPROVABLE.has(tool as PendingAction["tool"])
}

export async function actionKey(callId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(callId)))
  return Array.from(digest.slice(0, 6), (b) => b.toString(16).padStart(2, "0")).join("")
}

export async function botToken(admin: SupabaseClient, workspaceId: string): Promise<string | null> {
  const { data: integ } = await admin.from("integrations").select("status").eq("workspace_id", workspaceId).eq("provider", "telegram").maybeSingle()
  if (integ?.status !== "active") return null
  const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "telegram" })
  return parseTelegramSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)?.bot_token ?? null
}

function clip(s: string | null | undefined, n: number): string {
  const t = (s ?? "").trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

function props(p: Record<string, string>): string {
  return Object.entries(p).slice(0, 15).map(([k, v]) => `• ${k}: ${clip(v, 200)}`).join("\n")
}

// Lo que verá la persona antes de pulsar «Aprobar».
export function proposalDetail(p: PendingAction): string {
  switch (p.tool) {
    case "send_email":
      return `Para: ${p.to_label} <${p.address}>\nAsunto: ${p.subject}\n\n${clip(p.body, 2000)}`
    case "send_telegram":
      return `Para: ${p.to_label}\n\n${clip(p.text, 2000)}`
    case "send_whatsapp":
      return `Por WhatsApp a: ${p.to_label} (${p.phone})\n\n${clip(p.text, 2000)}`
    case "append_rows":
      return p.values.slice(0, 8).map((r) => `• ${clip(r.map((c) => (c === null ? "" : String(c))).join(" | "), 200)}`).join("\n") +
        (p.values.length > 8 ? `\n… y ${p.values.length - 8} filas más` : "")
    case "update_range":
      return `Celdas ${p.range} de «${p.file_name}».`
    case "append_to_document":
    case "create_document":
      return clip(p.text, 1500)
    case "save_file":
      return `Formato: ${p.format}\n\n${clip(p.text, 1500)}`
    case "create_event": {
      const who = p.attendees.length ? `\nInvitados: ${p.attendees.map((a) => a.label).join(", ")}` : ""
      return `«${p.event.title}»\n${p.event.start} → ${p.event.end}${p.event.location ? `\nLugar: ${p.event.location}` : ""}${who}`
    }
    case "update_event":
      return `Ahora: «${p.title_before}» (${p.when_before})\nCambios:\n${props(Object.fromEntries(
        Object.entries(p.changes).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)]),
      ))}`
    case "crm_create":
      return props(p.properties)
    case "crm_update":
      return props(Object.fromEntries(Object.entries(p.properties).map(([k, v]) => [k, `${p.before[k] ?? "—"} → ${v}`])))
    case "crm_note":
      return clip(p.text, 1500)
    case "crm_task":
      return `${p.subject}${p.due_date ? ` (vence ${p.due_date})` : ""}\n\n${clip(p.text, 1200)}`
    case "tokko_lead":
      return [p.name, p.email, p.phone].filter(Boolean).join(" · ") + (p.text ? `\n\n${clip(p.text, 1200)}` : "")
    case "api_request":
      return `${p.method} ${p.path}${p.query ? `?${clip(p.query, 300)}` : ""} en ${p.connection_name}${p.body ? `\n\n${clip(p.body, 1500)}` : ""}`
    case "buffer_post":
      return `En: ${p.channels.map((c) => `${c.name} (${c.service})`).join(", ")}\nCuándo: ${p.when_label}\n\n${clip(p.text, 1800)}`
  }
}

// Personas que deciden: quien lanzó la ejecución o, si no, los administradores.
async function deciders(admin: SupabaseClient, run: RunInfo): Promise<string[]> {
  const { data: members } = await admin.from("memberships").select("user_id, role").eq("workspace_id", run.workspace_id).eq("status", "active")
  const active = members ?? []
  return run.started_by && active.some((m) => m.user_id === run.started_by)
    ? [run.started_by]
    : active.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.user_id)
}

export async function approvalMessage(run: { id: string; flow_name: string }, pending: PendingAction, title: string): Promise<{ text: string; keyboard: InlineKeyboard }> {
  const text = `🔔 ${clip(run.flow_name, 80)}\n${title}\n\n${proposalDetail(pending)}`
  if (!approvableFromTelegram(pending.tool)) {
    return { text: `${text}\n\nEsta acción solo se puede aprobar en la app (Pendientes).`, keyboard: [] }
  }
  const key = await actionKey(pending.call_id)
  return {
    text,
    keyboard: [[
      { text: "✅ Aprobar", callback_data: `ap:${run.id}:${key}` },
      { text: "✖️ Rechazar", callback_data: `re:${run.id}:${key}` },
    ]],
  }
}

export async function telegramApproval(admin: SupabaseClient, run: RunInfo, pending: PendingAction, title: string): Promise<void> {
  const users = await deciders(admin, run)
  if (!users.length) return
  const { data: chats } = await admin
    .from("user_channels")
    .select("user_id, telegram_chat_id, notify_telegram")
    .eq("workspace_id", run.workspace_id)
    .in("user_id", users)
    .not("telegram_chat_id", "is", null)
  // Si la pidió por Telegram, la aprobación vuelve a ese chat aunque haya
  // desactivado los avisos de Telegram.
  const targets = (chats ?? []).filter((c) => c.notify_telegram || run.trigger.type === "telegram_chat")
  if (!targets.length) return
  const token = await botToken(admin, run.workspace_id)
  if (!token) return
  const { text, keyboard } = await approvalMessage(run, pending, title)
  for (const c of targets) {
    await sendTelegram(token, c.telegram_chat_id!, text, keyboard).catch((e) => console.error("telegram approval", e instanceof Error ? e.name : "error"))
  }
}

// Respuesta final de una petición hecha por Telegram.
export async function telegramRunResult(admin: SupabaseClient, run: RunInfo, status: "succeeded" | "failed", text: string): Promise<void> {
  if (run.trigger.type !== "telegram_chat") return
  const token = await botToken(admin, run.workspace_id)
  if (!token) return
  const body = status === "succeeded" ? text.trim() || "Hecho." : `No he podido terminar: ${text}`
  await sendTelegram(token, run.trigger.chat_id, body)
}

// Los bots conectados antes de los botones no reciben sus pulsaciones
// (callback_query). runs-cron vuelve a registrar su webhook una vez, con el
// mismo secreto y sin descartar mensajes pendientes.
export async function upgradeTelegramWebhooks(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("integrations")
    .select("id, workspace_id, config")
    .eq("provider", "telegram")
    .eq("status", "active")
    .or(`config->>webhook_v.is.null,config->>webhook_v.neq.${WEBHOOK_VERSION}`)
    .limit(5)
  let done = 0
  for (const integ of data ?? []) {
    try {
      const { data: rows } = await admin.rpc("integration_secret_by_id", { p_integration_id: integ.id })
      const secret = parseTelegramSecret((rows?.[0] as { secret?: string } | undefined)?.secret)
      if (!secret) continue
      await setWebhook(secret.bot_token, `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook?c=${integ.id}`, secret.secret_token, false)
      await admin.rpc("integration_set_config", {
        p_workspace_id: integ.workspace_id,
        p_provider: "telegram",
        p_config: { ...((integ.config ?? {}) as Record<string, unknown>), webhook_v: WEBHOOK_VERSION },
      })
      done++
    } catch (e) {
      console.error("telegram webhook upgrade", e instanceof Error ? e.name : "error")
    }
  }
  return done
}
