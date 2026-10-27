import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Punto de entrada de la app (y destino tras iniciar sesión): lleva a la
// pantalla Hoy del último espacio usado (cookie que pone el proxy) si el
// usuario sigue siendo miembro. Si no hay cookie, a su espacio personal o al
// primero que tenga; sin ninguno, a la lista de espacios. El proxy ya exige
// sesión para esta ruta.
export async function GET(request: NextRequest) {
  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin))
  const supabase = await createClient()

  const last = request.cookies.get("orkesta_ws")?.value
  if (last && UUID_RE.test(last)) {
    const { data } = await supabase.from("workspaces").select("id").eq("id", last).maybeSingle()
    if (data) return go(`/w/${data.id}`)
  }

  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return go("/login")
  const { data: memberships } = await supabase
    .from("memberships")
    .select("workspaces(id, kind)")
    .eq("user_id", userId)
    .eq("status", "active")
  const spaces = (memberships ?? []).flatMap((m) => (m.workspaces ? [m.workspaces] : []))
  const first = spaces.find((w) => w.kind === "personal") ?? spaces[0]
  return go(first ? `/w/${first.id}` : "/w")
}
