"use server"

import { refresh } from "next/cache"
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
  refresh()
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

// ---------------------------------------------------------------------------
// Gestión de la organización. La RLS decide quién puede: estas acciones solo
// validan la entrada y traducen el resultado. Si la base de datos no afecta a
// ninguna fila, es que la persona no tenía permiso.
// ---------------------------------------------------------------------------

export type ManageState = { error?: string; message?: string }

export async function revokeInvitation(formData: FormData): Promise<void> {
  const invitationId = String(formData.get("invitationId") ?? "")
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(invitationId) || !UUID_RE.test(workspaceId)) return

  const supabase = await sessionClient()
  await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
  refresh()
}

export async function renameWorkspace(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (name.length < 1 || name.length > 120) return { error: "Ponle un nombre de 1 a 120 caracteres." }

  const supabase = await sessionClient()
  const { data, error } = await supabase.from("workspaces").update({ name }).eq("id", workspaceId).select("id")
  if (error || !data?.length) return { error: "Solo un administrador puede cambiar el nombre." }
  refresh()
  return { message: "Nombre guardado." }
}

export async function deleteWorkspace(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const confirmName = String(formData.get("confirmName") ?? "").trim()
  const expected = String(formData.get("expectedName") ?? "").trim()
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (!confirmName || confirmName !== expected) {
    return { error: "Escribe el nombre exacto de la organización para confirmar." }
  }

  const supabase = await sessionClient()
  const { data, error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId)
    .eq("kind", "organization")
    .select("id")
  if (error || !data?.length) return { error: "Solo el propietario puede borrar la organización." }
  redirect("/w")
}

export async function leaveWorkspace(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }

  const supabase = await sessionClient()
  const { data: claims } = await supabase.auth.getClaims()
  const { data, error } = await supabase
    .from("memberships")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", claims!.claims!.sub)
    .select("user_id")
  if (error?.code === "42501") {
    return { error: "Eres el único propietario. Nombra antes a otro propietario o borra la organización." }
  }
  if (error || !data?.length) return { error: "No se pudo salir de la organización." }
  redirect("/w")
}
