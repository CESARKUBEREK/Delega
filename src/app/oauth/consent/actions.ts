"use server"

import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Pantalla de consentimiento del servidor OAuth 2.1 de Supabase Auth (fase 11):
// un asistente (Claude, ChatGPT, Grok Bot…) pide acceso; la persona elige el
// espacio y los permisos. Se guarda la conexión y luego se aprueba en Supabase.
// La redirección de vuelta al asistente la hace el navegador (la URL va a otro
// dominio y form-action solo permite el propio sitio y Supabase).

export type ConsentState = { error?: string; redirectUrl?: string }

const AUTH_ID_RE = /^[A-Za-z0-9_-]{8,200}$/

function scopesFrom(formData: FormData): string[] {
  const scopes = ["read"]
  if (formData.get("organize") === "on") scopes.push("organize")
  if (formData.get("drafts") === "on") scopes.push("drafts")
  return scopes
}

export async function approveConsent(_prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const authorizationId = String(formData.get("authorizationId") ?? "")
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!AUTH_ID_RE.test(authorizationId)) return { error: "La solicitud no es válida. Vuelve a conectar desde tu asistente." }
  if (!UUID_RE.test(workspaceId)) return { error: "Elige el espacio al que podrá acceder." }

  const supabase = await createClient()
  // El cliente y su nombre salen de Supabase, nunca del formulario.
  const { data: details, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (detailsError || !details) return { error: "La solicitud caducó. Vuelve a conectar desde tu asistente." }
  if (!("authorization_id" in details)) return { redirectUrl: details.redirect_url }

  const { error } = await supabase.rpc("mcp_oauth_connect", {
    p_workspace_id: workspaceId,
    p_client_id: details.client.id,
    p_name: details.client.name || "Asistente",
    p_scopes: scopesFrom(formData),
  })
  if (error) {
    if (error.code === "P0001") return { error: error.message }
    if (error.code === "42501") return { error: "Solo owners y admins del espacio pueden conectar asistentes." }
    return { error: "No se pudo guardar la conexión. Inténtalo de nuevo." }
  }

  const { data: done, error: approveError } = await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
  if (approveError || !done?.redirect_url) return { error: "No se pudo completar la autorización. Vuelve a conectar desde tu asistente." }
  return { redirectUrl: done.redirect_url }
}

export async function denyConsent(_prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const authorizationId = String(formData.get("authorizationId") ?? "")
  if (!AUTH_ID_RE.test(authorizationId)) return { error: "La solicitud no es válida." }
  const supabase = await createClient()
  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
  if (error || !data?.redirect_url) return { error: "No se pudo rechazar. Puedes cerrar esta ventana." }
  return { redirectUrl: data.redirect_url }
}
