import { NextResponse, type NextRequest } from "next/server"
import { safeNext } from "@/lib/safe-redirect"
import { createClient } from "@/lib/supabase/server"

// Retorno de OAuth (Google, Microsoft) con flujo PKCE: canjea el código por
// una sesión en cookies y continúa a una ruta interna.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = safeNext(searchParams.get("next"))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL("/auth/error?reason=oauth", origin))
}
