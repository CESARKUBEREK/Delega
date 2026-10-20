"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { callEdgeFunction } from "@/lib/edge-functions"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Acciones de Google Sheets y de ejecución. Los permisos los comprueban las
// Edge Functions; aquí solo se valida la forma de la entrada.

export type ActionResult = { ok: true } | { ok: false; error: string }

export async function connectGoogle(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return
  const result = await callEdgeFunction<{ url: string }>("google-connection", { action: "start", workspace_id: workspaceId }, 20_000)
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
  const result = await callEdgeFunction("google-connection", { action: "disconnect", workspace_id: workspaceId }, 20_000)
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Ejecuciones
// ---------------------------------------------------------------------------

export type RunStatus = "running" | "awaiting_approval" | "succeeded" | "failed" | "cancelled"
export type RunStep = { ok: true; status: RunStatus; runId: string } | { ok: false; code: string; error: string }

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

async function runAction(body: Record<string, unknown>): Promise<RunStep> {
  if (typeof body.run_id !== "string" || !UUID_RE.test(body.run_id)) return { ok: false, code: "bad_request", error: "Ejecución no válida." }
  const result = await callEdgeFunction<{ run_id: string; status: RunStatus }>("run-flow", body)
  if (result.error) return { ok: false, code: result.error.code, error: result.error.message }
  return { ok: true, status: result.data.status, runId: result.data.run_id }
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
// WhatsApp
// ---------------------------------------------------------------------------

export type WhatsAppState = { error?: string; message?: string; webhookUrl?: string; verifyToken?: string }

export async function saveWhatsApp(_prev: WhatsAppState, formData: FormData): Promise<WhatsAppState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const result = await callEdgeFunction<{ display_phone_number: string | null; webhook_url: string; verify_token: string }>(
    "whatsapp-connection",
    {
      action: "save",
      workspace_id: workspaceId,
      phone_number_id: String(formData.get("phoneNumberId") ?? ""),
      access_token: String(formData.get("accessToken") ?? ""),
      app_secret: String(formData.get("appSecret") ?? ""),
    },
    30_000,
  )
  if (result.error) return { error: result.error.message }
  refresh()
  return {
    message: `Número ${result.data.display_phone_number ?? ""} conectado. Ahora configura el webhook en Meta con estos datos.`,
    webhookUrl: result.data.webhook_url,
    verifyToken: result.data.verify_token,
  }
}

export async function whatsappWebhookInfo(workspaceId: string): Promise<WhatsAppState> {
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const result = await callEdgeFunction<{ webhook_url: string; verify_token: string }>(
    "whatsapp-connection",
    { action: "webhook_info", workspace_id: workspaceId },
    20_000,
  )
  if (result.error) return { error: result.error.message }
  return { webhookUrl: result.data.webhook_url, verifyToken: result.data.verify_token }
}

export async function disconnectWhatsApp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult | null> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { ok: false, error: "Espacio no válido." }
  const result = await callEdgeFunction("whatsapp-connection", { action: "disconnect", workspace_id: workspaceId }, 20_000)
  if (result.error) return { ok: false, error: result.error.message }
  refresh()
  return { ok: true }
}

// Contactos autorizados: la RLS solo deja a admins y owners.
export type ContactState = { error?: string; message?: string }

export async function addContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const phone = String(formData.get("phone") ?? "").replace(/[\s().-]/g, "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (!name || name.length > 120) return { error: "Escribe un nombre." }
  if (!/^\+[1-9][0-9]{6,14}$/.test(phone)) return { error: "Escribe el número con prefijo internacional, p. ej. +34600111222." }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")
  const { error } = await supabase.from("contacts").insert({ workspace_id: workspaceId, name, phone, created_by: userId })
  if (error) {
    return { error: error.code === "23505" ? "Ese número ya está en la lista." : "Solo un administrador puede añadir contactos." }
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
