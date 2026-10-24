import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Punto de entrada de la app instalada: lleva al chat del último espacio usado
// (cookie que pone el proxy) si el usuario sigue siendo miembro; si no, a la
// lista de espacios. El proxy ya exige sesión para esta ruta.
export async function GET(request: NextRequest) {
  const last = request.cookies.get("orkesta_ws")?.value
  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin))
  if (!last || !UUID_RE.test(last)) return go("/w")

  const supabase = await createClient()
  const { data } = await supabase.from("workspaces").select("id").eq("id", last).maybeSingle()
  return go(data ? `/w/${data.id}/asistente` : "/w")
}
