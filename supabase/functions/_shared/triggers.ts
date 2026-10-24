// Disparador «al llegar un correo»: tras leer el buzón IMAP, cada correo nuevo
// recibido puede lanzar las automatizaciones activas con disparador
// "email_message" cuyos filtros cumpla. Los filtros se comprueban aquí, sin IA,
// para no gastar la clave del cliente en cada correo.
//
// - Solo correos recibidos en las últimas 48 h y nunca en la primera lectura
//   del buzón (que trae el histórico).
// - Máximo 3 automatizaciones por correo y 30 ejecuciones por hora y espacio.
// - Las ejecuciones se crean aquí y las avanza runs-cron (cada minuto): lo que
//   quieran escribir o enviar espera la aprobación de una persona.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { createRun } from "./agent.ts"
import { isUuid } from "./core.ts"
import { resolveAi } from "./llm.ts"

export const MAX_EMAIL_RUNS_PER_HOUR = 30
const MAX_FLOWS_PER_MAIL = 3
export const TRIGGER_TEXT_CHARS = 4000

export type EmailFilter = {
  from: string[]
  subject: string[]
  words: string[]
  skip_automatic: boolean
}

export type FreshEmail = {
  id: number
  fromName: string | null
  fromAddress: string
  subject: string
  body: string
}

function list(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20)
}

export function parseEmailFilter(v: unknown): EmailFilter {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  return { from: list(o.from), subject: list(o.subject), words: list(o.words), skip_automatic: o.skip_automatic !== false }
}

// Remitentes que son máquinas: avisos, boletines, rebotes.
const AUTOMATIC_RE = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer[-_.]?daemon|postmaster|bounces?|notifications?|notificaciones|newsletter|news|alerts?|avisos)([+@._-]|$)/i

export function isAutomaticSender(address: string): boolean {
  return AUTOMATIC_RE.test(address.trim())
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")

// Cada lista no vacía tiene que cumplirse (basta una de sus palabras).
export function matchesEmail(filter: EmailFilter, mail: Pick<FreshEmail, "fromName" | "fromAddress" | "subject" | "body">): boolean {
  if (filter.skip_automatic && isAutomaticSender(mail.fromAddress)) return false
  const from = fold(`${mail.fromName ?? ""} <${mail.fromAddress}>`)
  const subject = fold(mail.subject)
  const all = `${subject}\n${fold(mail.body)}`
  if (filter.from.length && !filter.from.some((w) => from.includes(fold(w)))) return false
  if (filter.subject.length && !filter.subject.some((w) => subject.includes(fold(w)))) return false
  if (filter.words.length && !filter.words.some((w) => all.includes(fold(w)))) return false
  return true
}

export async function launchEmailFlows(admin: SupabaseClient, workspaceId: string, mails: FreshEmail[]): Promise<number> {
  if (!mails.length) return 0
  const { data: flows } = await admin
    .from("flows")
    .select("id, name, definition, created_by, settings")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("definition->trigger->>type", "email_message")
    .order("created_at")
    .limit(10)
  if (!flows?.length) return 0

  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("trigger->>type", "email_message")
    .gte("started_at", since)
  let budget = MAX_EMAIL_RUNS_PER_HOUR - (count ?? 0)
  if (budget <= 0) return 0

  const { data: rows } = await admin
    .from("inbox_messages")
    .select("id, thread_id")
    .eq("workspace_id", workspaceId)
    .in("id", mails.map((m) => m.id))
  const threadOf = new Map((rows ?? []).map((r) => [r.id as number, r.thread_id as string]))

  let launched = 0
  for (const mail of mails) {
    const threadId = threadOf.get(mail.id)
    if (!threadId) continue
    let perMail = 0
    for (const flow of flows) {
      if (budget <= 0) return launched
      if (perMail >= MAX_FLOWS_PER_MAIL) break
      const settings = (flow.settings ?? {}) as { file_ids?: unknown; model?: unknown; email_filter?: unknown }
      if (!matchesEmail(parseEmailFilter(settings.email_filter), mail)) continue
      const conn = await resolveAi(admin, workspaceId, typeof settings.model === "string" ? settings.model : null)
      if (!conn) return launched
      const fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter(isUuid).slice(0, 5) : []
      try {
        const run = await createRun(admin, {
          workspaceId,
          flow,
          fileIds,
          note: "",
          model: conn.model,
          startedBy: flow.created_by,
          trigger: {
            type: "email_message",
            message_id: mail.id,
            thread_id: threadId,
            name: mail.fromName?.slice(0, 200) ?? null,
            address: mail.fromAddress.slice(0, 320),
            subject: mail.subject.slice(0, 300),
            text: mail.body.slice(0, TRIGGER_TEXT_CHARS),
          },
        })
        await admin.from("inbox_messages").update({ run_id: run.id }).eq("id", mail.id)
        budget--
        perMail++
        launched++
      } catch (e) {
        console.error("email trigger", e instanceof Error ? e.name : "error")
      }
    }
  }
  return launched
}
