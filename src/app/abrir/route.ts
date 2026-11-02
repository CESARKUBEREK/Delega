import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Punto de entrada de la app (y destino tras iniciar sesión): lleva a la
// pantalla Hoy del último espacio usado (cookie que pone el proxy) si el
// usuario sigue siendo miembro. Si no hay cookie, a su espacio personal o al
// primero que tenga; sin ninguno, a la lista de espacios. El proxy ya exige
// sesión para esta ruta. Un espacio recién creado (sin IA ni ninguna
// conexión) abre el onboarding si el usuario lo administra y aún no se ha
// terminado en ese espacio.
export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin))
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return go("/entrar")

  const home = async (workspaceId: string) => {
    const [{ data: membership }, { data: workspace }, { count: ai }, { count: integrations }] = await Promise.all([
      supabase.from("memberships").select("role, status").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle(),
      supabase.from("workspaces").select("onboarding_completed_at").eq("id", workspaceId).maybeSingle(),
      supabase.from("ai_connections").select("workspace_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      supabase.from("integrations").select("workspace_id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ])
    const admin = membership?.status === "active" && (membership.role === "owner" || membership.role === "admin")
    const onboarded = Boolean(workspace?.onboarding_completed_at)
    return go(admin && !ai && !integrations && !onboarded ? `/w/${workspaceId}/onboarding` : `/w/${workspaceId}`)
  }

  const last = request.cookies.get("orkesta_ws")?.value
  if (last && UUID_RE.test(last)) {
    const { data } = await supabase.from("workspaces").select("id").eq("id", last).maybeSingle()
    if (data) return home(data.id)
  }

  const { data: memberships } = await supabase
    .from("memberships")
    .select("workspaces(id, kind)")
    .eq("user_id", userId)
    .eq("status", "active")
  const spaces = (memberships ?? []).flatMap((m) => (m.workspaces ? [m.workspaces] : []))
  const first = spaces.find((w) => w.kind === "personal") ?? spaces[0]
  return first ? home(first.id) : go("/w")
}
