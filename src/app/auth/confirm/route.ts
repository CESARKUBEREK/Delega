import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { safeNext } from "@/lib/safe-redirect"
import { createClient } from "@/lib/supabase/server"

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"]

// Enlaces de los correos de Supabase (confirmación de alta, recuperación de
// contraseña, cambio de correo). Usa token_hash para que funcione aunque el
// enlace se abra en otro dispositivo.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const code = searchParams.get("code")
  const next = safeNext(searchParams.get("next"))
  const supabase = await createClient()

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const target = type === "recovery" ? "/reset-password" : next
      return NextResponse.redirect(new URL(target, origin))
    }
  } else if (code) {
    // Plantillas por defecto de Supabase (flujo PKCE en el mismo navegador).
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  return NextResponse.redirect(new URL("/auth/error?reason=link", origin))
}
