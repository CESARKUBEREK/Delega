"use server"

import { redirect } from "next/navigation"
import { siteUrl } from "@/lib/site-url"
import { createClient } from "@/lib/supabase/server"

export type WorkspaceFormState = { error?: string; inviteLink?: string; inviteEmail?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// Cada acción vuelve a comprobar la sesión; los permisos finos los aplica la
// base de datos (RLS y funciones), nunca este código.
async function sessionClient() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect("/login")
  return supabase
}

export async function createOrganization(_prev: WorkspaceFormState, formData: FormData): Promise<WorkspaceFormState> {
  const name = String(formData.get("name") ?? "").trim()
  if (name.length < 1 || name.length > 120) return { error: "Ponle un nombre de 1 a 120 caracteres." }

  const supabase = await sessionClient()
  const { data, error } = await supabase.rpc("create_organization", { p_name: name })
  if (error) {
    return {
      error:
        error.code === "54000"
          ? "Has alcanzado el límite de organizaciones."
          : "No se pudo crear la organización. Inténtalo de nuevo.",
    }
  }
  redirect(`/w/${data}`)
}

export async function createInvitation(_prev: WorkspaceFormState, formData: FormData): Promise<WorkspaceFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const role = formData.get("role") === "admin" ? "admin" : "member"

  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (!EMAIL_RE.test(email)) return { error: "Ese correo no es válido." }

  const supabase = await sessionClient()
  const { data, error } = await supabase.rpc("create_invitation", {
    p_workspace_id: workspaceId,
    p_email: email,
    p_role: role,
  })
  if (error || !data?.[0]) {
    const messages: Record<string, string> = {
      "42501": "Solo un administrador puede invitar a este espacio.",
      "23505": "Esa persona ya es miembro o tiene una invitación pendiente.",
      "22023": "No se puede invitar a este espacio.",
    }
    return { error: (error?.code && messages[error.code]) || "No se pudo crear la invitación." }
  }

  // El token va en el fragmento (#): el navegador no lo envía al servidor ni
  // queda en registros. Mientras no exista el envío por correo, se copia a mano.
  const origin = await siteUrl()
  return { inviteLink: `${origin}/invite#${data[0].token}`, inviteEmail: email }
}

export async function acceptInvitation(token: string): Promise<{ workspaceId?: string; error?: string; needsLogin?: boolean }> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "El enlace de invitación no es válido." }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) return { needsLogin: true }

  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token })
  if (error || !data) {
    return {
      error:
        "La invitación no es válida, ha caducado o es para otro correo. Entra con el correo al que te invitaron o pide una nueva.",
    }
  }
  return { workspaceId: data }
}
