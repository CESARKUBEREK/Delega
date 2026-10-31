"use server"

import { refresh } from "next/cache"
import { callEdgeFunction } from "@/lib/edge-functions"
import { domainOf, PUBLIC_DOMAINS } from "@/lib/inbox"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Acciones de la bandeja de acciones (fase 6G). La RLS deja tocar la bandeja
// solo a owners y admins; aquí se valida la forma de la entrada.

export type InboxActionResult = { ok: true; message?: string } | { ok: false; error: string }
const NOT_ALLOWED = "Solo un administrador puede cambiar la bandeja."

// Una conversación que la persona pone en una categoría normal deja de
// contarse como boletín o aviso (y vuelve a la lista principal).
const isNoise = (category: string) => category.trim().toLowerCase() === "publicidad"

const validIds = (workspaceId: string, ids: string[]) => UUID_RE.test(workspaceId) && ids.length > 0 && ids.every((id) => UUID_RE.test(id))

// Cambia la categoría con un toque. Devuelve qué regla se puede ofrecer.
export async function setThreadCategory(
  workspaceId: string,
  threadId: string,
  category: string,
): Promise<{ ok: true; sender: string | null; domain: string | null } | { ok: false; error: string }> {
  if (!validIds(workspaceId, [threadId])) return { ok: false, error: "Datos no válidos." }
  const value = category.trim().slice(0, 60)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inbox_threads")
    .update({ category: value || null, manually_edited: true, category_source: "user", automatic: isNoise(value) })
    .eq("id", threadId)
    .eq("workspace_id", workspaceId)
    .select("contact_address")
  if (error || !data?.length) return { ok: false, error: NOT_ALLOWED }
  refresh()
  const sender = data[0].contact_address?.toLowerCase() ?? null
  const domain = domainOf(sender)
  return { ok: true, sender: sender?.includes("@") ? sender : null, domain: domain && !PUBLIC_DOMAINS.has(domain) ? domain : null }
}

// «Siempre para este remitente / dominio»: crea la regla y la aplica a las
// conversaciones que ya hay (salvo las corregidas a mano).
export async function createInboxRule(workspaceId: string, matchType: "sender" | "domain", value: string, category: string): Promise<InboxActionResult> {
  const v = value.trim().toLowerCase().slice(0, 320)
  const cat = category.trim().slice(0, 60)
  if (!UUID_RE.test(workspaceId) || !cat || v.length < 3) return { ok: false, error: "Datos no válidos." }
  if (matchType === "sender" ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) : !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(v)) return { ok: false, error: "Dirección o dominio no válido." }
  if (matchType === "domain" && PUBLIC_DOMAINS.has(v)) return { ok: false, error: "No se pueden crear reglas para dominios de correo personal." }
  const supabase = await createClient()
  const { error } = await supabase
    .from("inbox_rules")
    .upsert({ workspace_id: workspaceId, match_type: matchType, value: v, category: cat }, { onConflict: "workspace_id,match_type,value" })
  if (error) return { ok: false, error: NOT_ALLOWED }
  let q = supabase
    .from("inbox_threads")
    .update({ category: cat, category_source: "rule", automatic: isNoise(cat) })
    .eq("workspace_id", workspaceId)
    .eq("manually_edited", false)
  q = matchType === "sender" ? q.eq("contact_address", v) : q.or(`contact_address.ilike.%@${v},contact_address.ilike.%.${v}`)
  await q
  refresh()
  return { ok: true, message: matchType === "sender" ? `Los mensajes de ${v} irán a «${cat}».` : `Todo lo de @${v} irá a «${cat}».` }
}

export async function deleteInboxRule(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const ruleId = String(formData.get("ruleId") ?? "")
  if (!validIds(workspaceId, [ruleId])) return
  const supabase = await createClient()
  await supabase.from("inbox_rules").delete().eq("id", ruleId).eq("workspace_id", workspaceId)
  refresh()
}

// Varias conversaciones a la vez: archivar o recategorizar.
export async function bulkUpdateThreads(
  workspaceId: string,
  threadIds: string[],
  change: { archived?: boolean; category?: string },
): Promise<InboxActionResult> {
  const ids = threadIds.slice(0, 200)
  if (!validIds(workspaceId, ids)) return { ok: false, error: "Datos no válidos." }
  const patch: { archived?: boolean; category?: string; manually_edited?: boolean; category_source?: string; automatic?: boolean } = {}
  if (typeof change.archived === "boolean") patch.archived = change.archived
  if (typeof change.category === "string" && change.category.trim()) {
    patch.category = change.category.trim().slice(0, 60)
    patch.manually_edited = true
    patch.category_source = "user"
    patch.automatic = isNoise(patch.category)
  }
  if (!Object.keys(patch).length) return { ok: false, error: "Nada que cambiar." }
  const supabase = await createClient()
  const { data, error } = await supabase.from("inbox_threads").update(patch).eq("workspace_id", workspaceId).in("id", ids).select("id")
  if (error || !data?.length) return { ok: false, error: NOT_ALLOWED }
  refresh()
  return { ok: true, message: `${data.length} conversación${data.length === 1 ? "" : "es"} actualizada${data.length === 1 ? "" : "s"}.` }
}

// Tarjetas de «Para hoy».
export async function prepareReply(workspaceId: string, threadId: string, mode: "reply" | "followup"): Promise<InboxActionResult> {
  if (!validIds(workspaceId, [threadId])) return { ok: false, error: "Datos no válidos." }
  const result = await callEdgeFunction<{ run_id: string }>(
    "inbox-reply",
    { action: "prepare", workspace_id: workspaceId, thread_id: threadId, mode: mode === "followup" ? "followup" : "reply" },
    30_000,
  )
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true }
}

export async function dismissCard(workspaceId: string, threadId: string): Promise<InboxActionResult> {
  if (!validIds(workspaceId, [threadId])) return { ok: false, error: "Datos no válidos." }
  const supabase = await createClient()
  const { data } = await supabase
    .from("inbox_threads")
    .update({ prepare_dismissed_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("workspace_id", workspaceId)
    .select("id")
  if (!data?.length) return { ok: false, error: NOT_ALLOWED }
  refresh()
  return { ok: true }
}

export async function muteFollowup(workspaceId: string, threadId: string): Promise<InboxActionResult> {
  if (!validIds(workspaceId, [threadId])) return { ok: false, error: "Datos no válidos." }
  const supabase = await createClient()
  const { data } = await supabase.from("inbox_threads").update({ followup_muted: true }).eq("id", threadId).eq("workspace_id", workspaceId).select("id")
  if (!data?.length) return { ok: false, error: NOT_ALLOWED }
  refresh()
  return { ok: true }
}

export type SenderProfile = {
  hubspot: null | {
    contact: { name: string; email: string | null; phone: string | null; url: string | null }
    company: { name: string; url: string | null } | null
    deals: { name: string; stage: string | null; amount: string | null; url: string | null }[]
  }
  hubspotConnected: boolean
  xubio: null | { name: string }
  xubioConnected: boolean
}

export async function senderProfile(workspaceId: string, threadId: string): Promise<SenderProfile | null> {
  if (!validIds(workspaceId, [threadId])) return null
  const result = await callEdgeFunction<{ profile: SenderProfile }>("inbox-reply", { action: "profile", workspace_id: workspaceId, thread_id: threadId }, 25_000)
  return result.error ? null : result.data.profile
}
