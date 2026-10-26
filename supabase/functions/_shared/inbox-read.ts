// Lectura de la bandeja para el agente (sin aprobación): listar conversaciones
// y leer una. Responder a una conversación de correo es una acción aparte
// (reply_email) que espera aprobación.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

const MAX_THREADS = 30
const MAX_MESSAGES = 20
const MAX_BODY = 3000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type InboxThreadRow = {
  id: string
  channel: string
  external_id: string
  subject: string | null
  contact_name: string | null
  contact_address: string | null
  last_message_at: string | null
}

export async function inboxList(
  admin: SupabaseClient,
  workspaceId: string,
  args: { since_hours?: unknown; unanswered?: unknown; category?: unknown; limit?: unknown },
) {
  const hours = typeof args.since_hours === "number" && args.since_hours > 0 ? Math.min(args.since_hours, 24 * 90) : 0
  const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(Math.trunc(args.limit), MAX_THREADS) : 20
  const category = typeof args.category === "string" ? args.category.trim().slice(0, 60) : ""
  const unanswered = args.unanswered === true

  let q = admin
    .from("inbox_threads")
    .select("id, channel, subject, contact_name, contact_address, last_message_at, message_count, category, urgency, needs_reply, summary")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .order("last_message_at", { ascending: false })
    .limit(unanswered ? MAX_THREADS * 2 : limit)
  if (hours) q = q.gte("last_message_at", new Date(Date.now() - hours * 3_600_000).toISOString())
  if (category) q = q.ilike("category", category)
  const { data: threads, error } = await q
  if (error) return { error: "No se pudo leer la bandeja." }
  if (!threads?.length) return { threads: [] }

  // Quién habló el último en cada conversación.
  const { data: msgs } = await admin
    .from("inbox_messages")
    .select("thread_id, direction, sent_at")
    .eq("workspace_id", workspaceId)
    .in("thread_id", threads.map((t) => t.id))
    .order("sent_at", { ascending: false })
    .limit(500)
  const last = new Map<string, string>()
  for (const m of msgs ?? []) if (!last.has(m.thread_id)) last.set(m.thread_id, m.direction)

  const rows = threads
    .map((t) => ({
      thread: t.id,
      channel: t.channel === "email" ? "correo" : t.channel,
      subject: t.subject,
      contact: t.contact_name && t.contact_address ? `${t.contact_name} <${t.contact_address}>` : t.contact_name ?? t.contact_address,
      last_message_at: t.last_message_at,
      messages: t.message_count,
      last_from: last.get(t.id) === "out" ? "nosotros" : "contacto",
      category: t.category,
      urgency: t.urgency,
      needs_reply: t.needs_reply,
      summary: t.summary,
    }))
    .filter((t) => !unanswered || t.last_from === "contacto")
    .slice(0, limit)
  return { threads: rows }
}

export async function loadThread(admin: SupabaseClient, workspaceId: string, threadId: unknown): Promise<InboxThreadRow | null> {
  if (typeof threadId !== "string" || !UUID_RE.test(threadId)) return null
  const { data } = await admin
    .from("inbox_threads")
    .select("id, channel, external_id, subject, contact_name, contact_address, last_message_at")
    .eq("workspace_id", workspaceId)
    .eq("id", threadId)
    .maybeSingle()
  return (data as InboxThreadRow | null) ?? null
}

export async function inboxRead(admin: SupabaseClient, workspaceId: string, threadId: unknown) {
  const thread = await loadThread(admin, workspaceId, threadId)
  if (!thread) return { error: "No existe esa conversación." }
  const { data } = await admin
    .from("inbox_messages")
    .select("direction, sender_name, sender_address, subject, body, sent_at")
    .eq("workspace_id", workspaceId)
    .eq("thread_id", thread.id)
    .order("sent_at", { ascending: false })
    .limit(MAX_MESSAGES)
  const messages = (data ?? []).reverse().map((m) => ({
    from: m.direction === "out" ? "nosotros" : m.sender_name || m.sender_address || "contacto",
    sent_at: m.sent_at,
    subject: m.subject,
    text: (m.body ?? "").slice(0, MAX_BODY),
  }))
  return {
    thread: thread.id,
    channel: thread.channel === "email" ? "correo" : thread.channel,
    subject: thread.subject,
    contact: thread.contact_name ?? thread.contact_address,
    messages,
  }
}
