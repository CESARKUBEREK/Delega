"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { callEdgeFunction } from "@/lib/edge-functions"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Acciones de Google, Telegram, bandeja y ejecución. Los permisos los comprueban las
// Edge Functions; aquí solo se valida la forma de la entrada.

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function connectGoogle(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return
  const p = formData.get("product")
  const product = p === "gmail" || p === "calendar" ? p : "drive"
  const result = await callEdgeFunction<{ url: string }>("google-connection", { action: "start", workspace_id: workspaceId, product }, 20_000)
  if (result.error) redirect(`/w/${workspaceId}/integraciones?google_error=${encodeURIComponent(result.error.code)}`)
  // Solo se sigue una URL de consentimiento de Google.
  if (!result.data.url.startsWith("https://accounts.google.com/")) return
  redirect(result.data.url)
}

export async function googlePickerToken(workspaceId: string): Promise<{ token?: string; error?: string }> {
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const result = await callEdgeFunction<{ access_token: string }>("google-connection", { action: "picker_token", workspace_id: workspaceId }, 20_000)
  if (result.error) return { error: result.error.message }
  return { token: result.data.access_token }
}

export async function addPickedFiles(
  workspaceId: string,
  files: { id: string }[],
): Promise<{ added?: string[]; skipped?: string[]; error?: string }> {
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const ids = files.map((f) => String(f.id)).filter((id) => /^[A-Za-z0-9_-]{10,200}$/.test(id)).slice(0, 20)
  if (!ids.length) return { error: "No se eligió ninguna planilla." }
  const result = await callEdgeFunction<{ added: string[]; skipped: string[] }>(
    "google-connection",
    { action: "add_files", workspace_id: workspaceId, files: ids.map((id) => ({ id })) },
    60_000,
  )
  if (result.error) return { error: result.error.message }
  refresh()
  return { added: result.data.added, skipped: result.data.skipped }
}

export async function removeSheet(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const fileId = String(formData.get("fileId") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(fileId)) return
  await callEdgeFunction("google-connection", { action: "remove_file", workspace_id: workspaceId, file_id: fileId }, 20_000)
  refresh()
}

export async function disconnectGoogle(_prev: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { ok: false, error: "Espacio no válido." }
  const p = formData.get("product")
  const product = p === "gmail" || p === "calendar" ? p : "google"
  const result = await callEdgeFunction("google-connection", { action: "disconnect", workspace_id: workspaceId, product }, 20_000)
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Ejecuciones
// ---------------------------------------------------------------------------

export type RunStatus = "running" | "awaiting_approval" | "succeeded" | "failed" | "cancelled"
export type RunStep = { ok: true; status: RunStatus; runId: string; busy?: boolean } | { ok: false; code: string; error: string }

export async function startRun(input: {
  workspaceId: string
  flowId: string
  fileIds: string[]
  note: string
}): Promise<RunStep> {
  if (!UUID_RE.test(input.workspaceId) || !UUID_RE.test(input.flowId)) return { ok: false, code: "bad_request", error: "Datos no válidos." }
  const fileIds = input.fileIds.filter((id) => UUID_RE.test(id)).slice(0, 5)
  const result = await callEdgeFunction<{ run_id: string; status: RunStatus }>("run-flow", {
    action: "start",
    workspace_id: input.workspaceId,
    flow_id: input.flowId,
    file_ids: fileIds,
    note: input.note.slice(0, 2000),
  })
  if (result.error) return { ok: false, code: result.error.code, error: result.error.message }
  return { ok: true, status: result.data.status, runId: result.data.run_id }
}

// «Ejecutar ahora» desde el chat. La Edge Function lee el plan del mensaje
// con los permisos del usuario: aquí solo viaja su número.
export async function startRunFromMessage(input: { workspaceId: string; messageId: number; fileIds: string[] }): Promise<RunStep> {
  if (!UUID_RE.test(input.workspaceId) || !Number.isSafeInteger(input.messageId) || input.messageId <= 0) {
    return { ok: false, code: "bad_request", error: "Datos no válidos." }
  }
  const result = await callEdgeFunction<{ run_id: string; status: RunStatus }>("run-flow", {
    action: "start_from_message",
    workspace_id: input.workspaceId,
    message_id: input.messageId,
    file_ids: input.fileIds.filter((id) => UUID_RE.test(id)).slice(0, 5),
  })
  if (result.error) return { ok: false, code: result.error.code, error: result.error.message }
  refresh()
  return { ok: true, status: result.data.status, runId: result.data.run_id }
}

async function runAction(body: Record<string, unknown>): Promise<RunStep> {
  if (typeof body.run_id !== "string" || !UUID_RE.test(body.run_id)) return { ok: false, code: "bad_request", error: "Ejecución no válida." }
  const result = await callEdgeFunction<{ run_id: string; status: RunStatus; busy?: boolean }>("run-flow", body)
  if (result.error) return { ok: false, code: result.error.code, error: result.error.message }
  return { ok: true, status: result.data.status, runId: result.data.run_id, busy: result.data.busy === true }
}

export async function continueRun(runId: string): Promise<RunStep> {
  return runAction({ action: "continue", run_id: runId })
}

export async function decideRun(runId: string, approve: boolean): Promise<RunStep> {
  return runAction({ action: "decide", run_id: runId, approve })
}

export async function cancelRun(runId: string): Promise<RunStep> {
  return runAction({ action: "cancel", run_id: runId })
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------
export type TelegramState = { error?: string; message?: string }

export async function saveTelegram(_prev: TelegramState, formData: FormData): Promise<TelegramState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const token = String(formData.get("botToken") ?? "").trim()
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (!/^[0-9]{5,15}:[A-Za-z0-9_-]{30,60}$/.test(token)) return { error: "El token no tiene el formato de @BotFather (números:letras)." }
  const result = await callEdgeFunction<{ bot_username: string | null }>(
    "telegram-connection",
    { action: "save", workspace_id: workspaceId, bot_token: token },
    30_000,
  )
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: `Bot ${result.data.bot_username ? `@${result.data.bot_username} ` : ""}conectado.` }
}

export async function disconnectTelegram(_prev: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { ok: false, error: "Espacio no válido." }
  const result = await callEdgeFunction("telegram-connection", { action: "disconnect", workspace_id: workspaceId }, 20_000)
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// HubSpot
// ---------------------------------------------------------------------------
export type HubSpotState = { error?: string; message?: string }

export async function saveHubSpot(_prev: HubSpotState, formData: FormData): Promise<HubSpotState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const token = String(formData.get("token") ?? "").trim()
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (!/^[A-Za-z0-9_-]{20,300}$/.test(token)) return { error: "La clave no tiene el formato esperado (suele empezar por «pat-»)." }
  const result = await callEdgeFunction<{ portal_id: number | null }>("hubspot-connection", { action: "save", workspace_id: workspaceId, token }, 30_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: `HubSpot conectado${result.data.portal_id ? ` (cuenta ${result.data.portal_id})` : ""}.` }
}

export async function disconnectHubSpot(_prev: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { ok: false, error: "Espacio no válido." }
  const result = await callEdgeFunction("hubspot-connection", { action: "disconnect", workspace_id: workspaceId }, 20_000)
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true }
}

// Contactos autorizados para correo: la RLS solo deja a admins y owners.
export type ContactState = { error?: string; message?: string }

export async function addContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (!name || name.length > 120) return { error: "Escribe un nombre." }
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email) || email.length > 320) return { error: "Escribe un correo válido." }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")
  const { error } = await supabase.from("contacts").insert({ workspace_id: workspaceId, name, email, created_by: userId })
  if (error) {
    return { error: error.code === "23505" ? "Ese correo ya está en la lista." : "Solo un administrador puede añadir contactos." }
  }
  refresh()
  return { message: `${name} añadido.` }
}

export async function removeContact(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const contactId = String(formData.get("contactId") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(contactId)) return
  const supabase = await createClient()
  await supabase.from("contacts").delete().eq("id", contactId).eq("workspace_id", workspaceId)
  refresh()
}

// ---------------------------------------------------------------------------
// Activar un flujo con disparador automático
// ---------------------------------------------------------------------------
export async function setFlowActive(input: {
  workspaceId: string
  flowId: string
  active: boolean
  fileIds: string[]
}): Promise<ActionResult> {
  if (!UUID_RE.test(input.workspaceId) || !UUID_RE.test(input.flowId)) return { ok: false, error: "Datos no válidos." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("flows")
    .update({
      status: input.active ? "active" : "paused",
      settings: { file_ids: input.fileIds.filter((id) => UUID_RE.test(id)).slice(0, 5) },
    })
    .eq("id", input.flowId)
    .eq("workspace_id", input.workspaceId)
    .select("id")
  if (error || !data?.length) return { ok: false, error: "Solo quien creó el flujo o un administrador puede activarlo." }
  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Bandeja (correo y Telegram)
// ---------------------------------------------------------------------------
export type SettingsState = { error?: string; message?: string }

export async function syncInbox(workspaceId: string): Promise<{ ok: true; added: number; more: boolean } | { ok: false; error: string }> {
  if (!UUID_RE.test(workspaceId)) return { ok: false, error: "Espacio no válido." }
  const result = await callEdgeFunction<{ added: number; more: boolean }>("inbox-sync", { workspace_id: workspaceId }, 110_000)
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true, added: result.data.added, more: result.data.more }
}

export async function saveInboxSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const categories = String(formData.get("categories") ?? "")
    .split(/[\n,]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 15)
  const days = Number(formData.get("retentionDays"))
  const result = await callEdgeFunction(
    "inbox-classify",
    {
      action: "settings",
      workspace_id: workspaceId,
      categories,
      retention_days: Number.isFinite(days) && days >= 1 ? Math.trunc(days) : null,
    },
    30_000,
  )
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: "Ajustes guardados." }
}

export async function classifyThreads(
  workspaceId: string,
  threadId?: string,
): Promise<{ ok: true; classified: number; remaining: number } | { ok: false; error: string }> {
  if (!UUID_RE.test(workspaceId) || (threadId && !UUID_RE.test(threadId))) return { ok: false, error: "Datos no válidos." }
  const result = await callEdgeFunction<{ classified: number; remaining: number }>(
    "inbox-classify",
    { workspace_id: workspaceId, thread_id: threadId ?? null },
    110_000,
  )
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true, classified: result.data.classified, remaining: result.data.remaining }
}

export async function draftReply(
  workspaceId: string,
  threadId: string,
  instructions: string,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(threadId)) return { ok: false, error: "Datos no válidos." }
  const result = await callEdgeFunction<{ text: string }>(
    "inbox-reply",
    { action: "draft", workspace_id: workspaceId, thread_id: threadId, instructions: instructions.slice(0, 1000) },
    80_000,
  )
  if (result.error) return { ok: false, error: result.error.message }
  return { ok: true, text: result.data.text }
}

export async function sendReply(workspaceId: string, threadId: string, text: string): Promise<ActionResult> {
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(threadId)) return { ok: false, error: "Datos no válidos." }
  if (!text.trim()) return { ok: false, error: "Escribe la respuesta." }
  const result = await callEdgeFunction("inbox-reply", { action: "send", workspace_id: workspaceId, thread_id: threadId, text: text.slice(0, 8000) }, 60_000)
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true }
}

export async function updateThread(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const threadId = String(formData.get("threadId") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(threadId)) return { error: "Datos no válidos." }
  const text = (k: string, n: number) => {
    const v = String(formData.get(k) ?? "").trim()
    return v ? v.slice(0, n) : null
  }
  const urgency = String(formData.get("urgency") ?? "")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("inbox_threads")
    .update({
      category: text("category", 60),
      client: text("client", 120),
      project: text("project", 120),
      urgency: ["alta", "media", "baja"].includes(urgency) ? urgency : null,
      needs_reply: formData.get("needsReply") === "on",
      archived: formData.get("archived") === "on",
      manually_edited: true,
    })
    .eq("id", threadId)
    .eq("workspace_id", workspaceId)
    .select("id")
  if (error || !data?.length) return { error: "Solo un administrador puede corregir la clasificación." }
  refresh()
  return { message: "Clasificación guardada. La IA ya no cambiará estos campos." }
}

// ---------------------------------------------------------------------------
// Avisos en el móvil (Web Push)
// ---------------------------------------------------------------------------
// Servicios de push de los navegadores: el servidor solo envía avisos a estos.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
]
const B64URL = /^[A-Za-z0-9_-]+$/

export async function savePushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string
}): Promise<ActionResult> {
  let url: URL
  try {
    url = new URL(input.endpoint)
  } catch {
    return { ok: false, error: "Este navegador devolvió una suscripción no válida." }
  }
  if (url.protocol !== "https:" || url.port || !PUSH_HOSTS.some((re) => re.test(url.hostname)) || input.endpoint.length > 1000) {
    return { ok: false, error: "Este navegador usa un servicio de avisos que Orkesta no admite." }
  }
  const p256dh = input.p256dh.replace(/=+$/, "")
  const auth = input.auth.replace(/=+$/, "")
  if (!B64URL.test(p256dh) || !B64URL.test(auth)) return { ok: false, error: "Este navegador devolvió claves no válidas." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("push_subscribe", {
    p_endpoint: input.endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: input.userAgent.slice(0, 300),
  })
  if (error) return { ok: false, error: "No se pudieron activar los avisos en este dispositivo." }
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  if (!endpoint.startsWith("https://") || endpoint.length > 1000) return { ok: false, error: "Suscripción no válida." }
  const supabase = await createClient()
  // La RLS solo deja borrar los dispositivos propios.
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
  return { ok: true }
}

export async function sendTestPush(): Promise<ActionResult> {
  const result = await callEdgeFunction("push", { action: "test" }, 30_000)
  if (result.error) return { ok: false, error: result.error.message }
  return { ok: true }
}
