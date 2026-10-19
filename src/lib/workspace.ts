import "server-only"
import { notFound } from "next/navigation"
import { cache } from "react"
import { requireUser } from "@/lib/auth"
import type { Enums } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type WorkspaceContext = {
  user: Awaited<ReturnType<typeof requireUser>>
  workspace: { id: string; name: string; kind: Enums<"workspace_kind"> }
  role: Enums<"workspace_role"> | null
  isAdmin: boolean
}

// Espacio actual y rol del usuario. La RLS solo devuelve el espacio si el
// usuario es miembro activo; si no, 404. Se memoriza por petición para que
// el layout y la página no repitan las consultas.
export const getWorkspace = cache(async (workspaceId: string, next?: string): Promise<WorkspaceContext> => {
  if (!UUID_RE.test(workspaceId)) notFound()
  const user = await requireUser(next ?? `/w/${workspaceId}`)
  const supabase = await createClient()

  const [{ data: workspace }, { data: membership }] = await Promise.all([
    supabase.from("workspaces").select("id, name, kind").eq("id", workspaceId).maybeSingle(),
    supabase
      .from("memberships")
      .select("role, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ])
  if (!workspace) notFound()

  const role = membership?.status === "active" ? membership.role : null
  return { user, workspace, role, isAdmin: role === "owner" || role === "admin" }
})
