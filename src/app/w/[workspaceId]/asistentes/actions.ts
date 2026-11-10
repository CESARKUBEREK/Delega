"use server"

import { refresh } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Asistentes conectados por MCP (fase 11). Los permisos los comprueban las
// funciones de la base de datos (solo owners y admins del espacio).

export type KeyState = { error?: string; apiKey?: string; name?: string }
export type RevokeState = { error?: string; message?: string }

export async function createMcpKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const name = String(formData.get("name") ?? "").trim().slice(0, 80)
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (!name) return { error: "Ponle un nombre, por ejemplo «Grok Bot del Mac»." }
  const scopes = ["read"]
  if (formData.get("organize") === "on") scopes.push("organize")
  if (formData.get("drafts") === "on") scopes.push("drafts")

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("mcp_key_create", { p_workspace_id: workspaceId, p_name: name, p_scopes: scopes })
  if (error) {
    if (error.code === "P0001") return { error: error.message }
    if (error.code === "42501") return { error: "Solo owners y admins pueden conectar asistentes." }
    return { error: "No se pudo crear la clave." }
  }
  const row = data?.[0]
  if (!row?.api_key) return { error: "No se pudo crear la clave." }
  refresh()
  return { apiKey: row.api_key, name }
}

export async function revokeMcpConnection(_prev: RevokeState, formData: FormData): Promise<RevokeState> {
  const id = String(formData.get("connectionId") ?? "")
  if (!UUID_RE.test(id)) return { error: "Conexión no válida." }
  const supabase = await createClient()
  const { data: row } = await supabase.from("mcp_connections").select("user_id").eq("id", id).maybeSingle()
  const { data: clientId, error } = await supabase.rpc("mcp_connection_revoke", { p_id: id })
  if (error) return { error: "No se pudo revocar la conexión." }
  // Si la autorización OAuth es de esta persona, también se retira en Supabase
  // Auth: así el asistente tendrá que pedir permiso otra vez.
  if (clientId) {
    const { data: claims } = await supabase.auth.getClaims()
    if (row?.user_id && claims?.claims?.sub === row.user_id) {
      await supabase.auth.oauth.revokeGrant({ clientId }).catch(() => null)
    }
  }
  refresh()
  return { message: "Conexión revocada. Deja de funcionar ahora mismo." }
}
