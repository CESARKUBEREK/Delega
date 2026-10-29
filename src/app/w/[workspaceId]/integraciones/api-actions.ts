"use server"

import { revalidatePath } from "next/cache"
import { callEdgeFunction } from "@/lib/edge-functions"

export type ApiConnectionState = { ok?: boolean; error?: string; message?: string }

export async function saveApiConnection(_previous: ApiConnectionState, formData: FormData): Promise<ApiConnectionState> {
  const workspaceId = String(formData.get("workspace_id") ?? "")
  const provider = String(formData.get("provider") ?? "")
  const body: Record<string, string> = { action: "save", workspace_id: workspaceId, provider }
  if (provider === "supabase") {
    body.project_url = String(formData.get("project_url") ?? "").trim()
    body.anon_key = String(formData.get("anon_key") ?? "").trim()
  } else if (provider === "custom_1" || provider === "custom_2") {
    body.name = String(formData.get("name") ?? "").trim()
    body.base_url = String(formData.get("base_url") ?? "").trim()
    body.auth_type = String(formData.get("auth_type") ?? "none")
    body.header_name = String(formData.get("header_name") ?? "").trim()
    body.token = String(formData.get("token") ?? "")
  } else {
    return { error: "Integración no válida." }
  }

  const result = await callEdgeFunction<{ ok: true }>("api-connection", body, 20_000)
  if (result.error) return { error: result.error.message }
  revalidatePath(`/w/${workspaceId}/integraciones`)
  return { ok: true, message: "Conexión guardada. Las credenciales quedan cifradas." }
}

export async function disconnectApiConnection(_previous: ApiConnectionState, formData: FormData): Promise<ApiConnectionState> {
  const workspaceId = String(formData.get("workspace_id") ?? "")
  const provider = String(formData.get("provider") ?? "")
  if (!["supabase", "custom_1", "custom_2"].includes(provider)) return { error: "Integración no válida." }
  const result = await callEdgeFunction<{ ok: true }>("api-connection", { action: "disconnect", workspace_id: workspaceId, provider }, 20_000)
  if (result.error) return { error: result.error.message }
  revalidatePath(`/w/${workspaceId}/integraciones`)
  return { ok: true, message: "Integración desconectada. Su secreto se eliminó de MarchaSolo." }
}
