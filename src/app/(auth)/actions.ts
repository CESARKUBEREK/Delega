"use server"

import { redirect } from "next/navigation"
import { authErrorMessage } from "@/lib/auth-errors"
import { safeNext } from "@/lib/safe-redirect"
import { siteUrl } from "@/lib/site-url"
import { createClient } from "@/lib/supabase/server"

export type FormState = { error?: string; message?: string; email?: string }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MIN_PASSWORD = 10

function text(formData: FormData, key: string, max = 320): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function password(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.slice(0, 128) : ""
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase()
  const pass = password(formData, "password")
  const next = safeNext(formData.get("next"))

  if (!EMAIL_RE.test(email) || !pass) {
    return { error: "Escribe tu correo y tu contraseña.", email }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
  if (error) return { error: authErrorMessage(error.code), email }

  redirect(next)
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = text(formData, "name", 120)
  const email = text(formData, "email").toLowerCase()
  const pass = password(formData, "password")
  const next = safeNext(formData.get("next"))

  if (!EMAIL_RE.test(email)) return { error: "Ese correo no es válido.", email }
  if (pass.length < MIN_PASSWORD) {
    return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`, email }
  }

  const supabase = await createClient()
  const origin = await siteUrl()
  const { error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      data: name ? { full_name: name } : undefined,
    },
  })
  // Con la confirmación de correo activa, Supabase responde igual si el correo
  // ya existe: mostramos el mismo mensaje para no revelar cuentas.
  if (error) return { error: authErrorMessage(error.code), email }

  redirect("/check-email")
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"))
  const supabase = await createClient()
  const origin = await siteUrl()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  })
  if (error || !data.url) redirect("/auth/error?reason=oauth")
  redirect(data.url)
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase()
  if (!EMAIL_RE.test(email)) return { error: "Ese correo no es válido.", email }

  const supabase = await createClient()
  const origin = await siteUrl()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  })
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { error: authErrorMessage(error.code), email }
  }
  // Mismo mensaje exista o no la cuenta.
  return {
    message: "Si hay una cuenta con ese correo, te hemos enviado un enlace para crear una contraseña nueva.",
    email,
  }
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const pass = password(formData, "password")
  const confirm = password(formData, "confirm")
  if (pass.length < MIN_PASSWORD) return { error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.` }
  if (pass !== confirm) return { error: "Las dos contraseñas no coinciden." }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) return { error: authErrorMessage("session_not_found") }

  const { error } = await supabase.auth.updateUser({ password: pass })
  if (error) return { error: authErrorMessage(error.code) }

  redirect("/abrir")
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
