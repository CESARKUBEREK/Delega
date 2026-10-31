// Respuestas preparadas de la bandeja (fase 6G-3 y 6G-4).
//
// - Al llegar el correo (runs-cron): solo los de prioridad alta y los de
//   contactos conocidos (autorizados, a quien ya escribiste o que están en
//   HubSpot). Como mucho 30 al día por espacio (ajustable en la bandeja) y 3
//   por vuelta.
// - Al tocar «Preparar respuesta» o «Preparar recordatorio» en una tarjeta.
//
// Cada respuesta es una ejecución del agente (trigger «inbox_prepare») con el
// modelo principal del espacio: lee la conversación, consulta CRM, Tokko o la
// agenda si hace falta y deja el envío esperando aprobación, como siempre.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { createRun, type RunRow } from "./agent.ts"
import { isWorkspaceAdmin } from "./core.ts"
import { hubspotToken, search as hubspotSearch } from "./hubspot.ts"
import type { InboxConfig } from "./inbox.ts"
import { resolveAi } from "./llm.ts"

export const DEFAULT_DRAFTS_PER_DAY = 30
const AUTO_PER_TICK = 3
const AUTO_MAX_AGE_MS = 3 * 86_400_000
const HUBSPOT_LOOKUPS_PER_TICK = 5

export class PrepareError extends Error {
  constructor(public code: "not_found" | "channel" | "no_mail" | "no_ai" | "limit" | "busy", message: string) {
    super(message)
  }
}

type ThreadRow = {
  id: string
  channel: string
  subject: string | null
  contact_name: string | null
  contact_address: string | null
  prepare_run_id: string | null
}

export function draftsPerDay(config: InboxConfig | undefined): number {
  const n = Number((config as { drafts_per_day?: unknown } | undefined)?.drafts_per_day)
  return Number.isInteger(n) && n >= 0 && n <= 200 ? n : DEFAULT_DRAFTS_PER_DAY
}

async function inboxConfig(admin: SupabaseClient, workspaceId: string): Promise<{ config: InboxConfig | undefined; mailActive: boolean }> {
  const { data } = await admin.from("integrations").select("provider, status, config").eq("workspace_id", workspaceId).in("provider", ["imap", "telegram", "whatsapp"])
  const imap = (data ?? []).find((i) => i.provider === "imap")
  return { config: (imap ?? (data ?? [])[0])?.config as InboxConfig | undefined, mailActive: imap?.status === "active" }
}

async function preparedToday(admin: SupabaseClient, workspaceId: string): Promise<number> {
  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("trigger->>type", "inbox_prepare")
    .gte("started_at", new Date(Date.now() - 86_400_000).toISOString())
  return count ?? 0
}

// Prepara la respuesta (o el recordatorio) de una conversación de correo.
export async function prepareThread(
  admin: SupabaseClient,
  workspaceId: string,
  threadId: string,
  opts: { mode: "reply" | "followup"; startedBy: string; auto?: boolean },
): Promise<RunRow> {
  const { data: thread } = await admin
    .from("inbox_threads")
    .select("id, channel, subject, contact_name, contact_address, prepare_run_id")
    .eq("id", threadId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  const t = thread as ThreadRow | null
  if (!t) throw new PrepareError("not_found", "No se encontró la conversación.")
  if (t.channel !== "email" || !t.contact_address) throw new PrepareError("channel", "Por ahora solo se preparan respuestas de correo. Responde desde la conversación.")
  const { config, mailActive } = await inboxConfig(admin, workspaceId)
  if (!mailActive) throw new PrepareError("no_mail", "Tu correo no está conectado o rechazó la contraseña.")

  if (t.prepare_run_id) {
    const { data: prev } = await admin.from("flow_runs").select("status").eq("id", t.prepare_run_id).maybeSingle()
    if (prev && (prev.status === "running" || prev.status === "awaiting_approval")) throw new PrepareError("busy", "Ya se está preparando una respuesta para esta conversación.")
  }
  if (opts.auto && (await preparedToday(admin, workspaceId)) >= draftsPerDay(config)) {
    throw new PrepareError("limit", "Se alcanzó el límite diario de respuestas preparadas.")
  }

  const ai = await resolveAi(admin, workspaceId)
  if (!ai) throw new PrepareError("no_ai", "Conecta una IA en Integraciones.")

  // El mensaje de referencia: el último recibido (respuesta) o el último
  // nuestro (recordatorio).
  const { data: last } = await admin
    .from("inbox_messages")
    .select("id, body, subject, sender_name")
    .eq("thread_id", t.id)
    .eq("workspace_id", workspaceId)
    .eq("direction", opts.mode === "followup" ? "out" : "in")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const who = t.contact_name || t.contact_address
  const plan = {
    version: 1,
    name: (opts.mode === "followup" ? `Recordatorio a ${who}` : `Responder a ${who}`).slice(0, 120),
    summary: opts.mode === "followup" ? "Recordatorio en el mismo hilo a quien no ha contestado." : "Respuesta preparada desde la bandeja.",
    trigger: { type: "email_message", description: "Conversación de la bandeja" },
    connections: [
      { kind: "email", purpose: "Leer la conversación y responder" },
      { kind: "crm", purpose: "Ficha del contacto, si está conectado" },
      { kind: "properties", purpose: "Propiedades, si está conectado" },
      { kind: "calendar", purpose: "Huecos libres, si está conectado" },
    ],
    steps: [
      { id: "s1", kind: "read", title: "Leer la conversación", description: "Los últimos mensajes del hilo.", connection: "email", requires_approval: false },
      { id: "s2", kind: "read", title: "Buscar contexto", description: "CRM, Tokko o agenda, solo si hace falta.", connection: "crm", requires_approval: false },
      { id: "s3", kind: "notify", title: opts.mode === "followup" ? "Recordatorio" : "Responder", description: "En el mismo hilo.", connection: "email", requires_approval: true },
    ],
    open_questions: [],
  }

  const run = await createRun(admin, {
    workspaceId,
    flow: { id: null, name: plan.name, definition: plan },
    fileIds: [],
    note: "",
    model: ai.model,
    startedBy: opts.startedBy,
    trigger: {
      type: "inbox_prepare",
      mode: opts.mode,
      message_id: (last?.id as number | undefined) ?? null,
      thread_id: t.id,
      name: t.contact_name?.slice(0, 200) ?? null,
      address: t.contact_address.slice(0, 320),
      subject: (t.subject ?? last?.subject ?? "").slice(0, 300),
      text: String(last?.body ?? "").slice(0, 4000),
    },
  })
  await admin.from("inbox_threads").update({ prepare_run_id: run.id, prepare_dismissed_at: null }).eq("id", t.id).eq("workspace_id", workspaceId)
  return run
}

// Owner del espacio (o el primer admin): quien «lanza» las respuestas
// preparadas automáticamente. La bandeja es solo de owners y admins.
async function inboxOwner(admin: SupabaseClient, workspaceId: string): Promise<string | null> {
  const { data } = await admin.from("memberships").select("user_id, role").eq("workspace_id", workspaceId).in("role", ["owner", "admin"]).order("created_at").limit(5)
  const owner = (data ?? []).find((m) => m.role === "owner") ?? (data ?? [])[0]
  return owner?.user_id ?? null
}

// runs-cron: prepara las respuestas de lo que acaba de llegar y lo merece.
export async function autoPrepare(admin: SupabaseClient, workspaceId: string): Promise<number> {
  const { config, mailActive } = await inboxConfig(admin, workspaceId)
  if (!mailActive) return 0
  const limit = draftsPerDay(config)
  if (limit === 0) return 0
  let budget = Math.min(AUTO_PER_TICK, limit - (await preparedToday(admin, workspaceId)))
  if (budget <= 0) return 0
  const startedBy = await inboxOwner(admin, workspaceId)
  if (!startedBy || !(await isWorkspaceAdmin(admin, workspaceId, startedBy))) return 0

  const { data: candidates } = await admin
    .from("inbox_threads")
    .select("id, urgency, known_contact, contact_address, classified_count, message_count")
    .eq("workspace_id", workspaceId)
    .eq("channel", "email")
    .eq("archived", false)
    .eq("automatic", false)
    .eq("needs_reply", true)
    .eq("last_direction", "in")
    .is("prepare_run_id", null)
    .is("prepare_dismissed_at", null)
    .in("urgency", ["alta", "media"])
    .gte("last_message_at", new Date(Date.now() - AUTO_MAX_AGE_MS).toISOString())
    .order("last_message_at", { ascending: false })
    .limit(20)

  // Contactos de HubSpot: se consultan unos pocos por vuelta.
  let hubspot: { token: string } | null = null
  let lookups = 0
  let prepared = 0
  for (const c of candidates ?? []) {
    if (budget <= 0) break
    if (c.classified_count < c.message_count) continue
    let worth = c.urgency === "alta" || c.known_contact
    if (!worth && c.contact_address && lookups < HUBSPOT_LOOKUPS_PER_TICK) {
      hubspot ??= await hubspotToken(admin, workspaceId).catch(() => null)
      if (hubspot) {
        lookups++
        const found = await hubspotSearch(hubspot.token, "contacts", c.contact_address, 1).catch(() => [])
        if (found.some((r) => (r.properties.email ?? "").toLowerCase() === c.contact_address!.toLowerCase())) {
          worth = true
          await admin.from("inbox_threads").update({ known_contact: true }).eq("id", c.id).eq("workspace_id", workspaceId)
        }
      }
    }
    if (!worth) continue
    try {
      await prepareThread(admin, workspaceId, c.id, { mode: "reply", startedBy, auto: true })
      budget--
      prepared++
    } catch (e) {
      if (e instanceof PrepareError && (e.code === "limit" || e.code === "no_ai" || e.code === "no_mail")) break
      console.error("autoPrepare", e instanceof Error ? e.name : "error")
    }
  }
  return prepared
}
