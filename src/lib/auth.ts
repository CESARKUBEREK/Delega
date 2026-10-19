import "server-only"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type CurrentUser = {
  id: string
  email: string | null
  aal: string | null
}

// Capa de acceso: valida el JWT (getClaims) y devuelve solo lo necesario.
// La autorización de datos la hace la RLS; esto solo decide si hay sesión.
export async function requireUser(next?: string): Promise<CurrentUser> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login")
  }
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: typeof claims.aal === "string" ? claims.aal : null,
  }
}
