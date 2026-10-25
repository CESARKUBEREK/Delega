// Autorización de las tareas periódicas (pg_cron → pg_net → mail-cron y
// runs-cron). La llamada trae la cabecera x-orkesta-cron con el secreto
// «orkesta_mail_cron_secret» guardado en Vault. La función lo lee de Vault con
// la RPC cron_secret (solo service_role); si existe la variable
// MAIL_CRON_SECRET, se usa esa. Así no hace falta copiar el secreto a mano.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

let cached: string | null = null

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function cronSecret(admin: SupabaseClient): Promise<string> {
  const env = Deno.env.get("MAIL_CRON_SECRET")?.trim()
  if (env) return env
  if (cached) return cached
  const { data } = await admin.rpc("cron_secret")
  cached = typeof data === "string" ? data : ""
  return cached
}

export async function cronAuthorized(req: Request, admin: SupabaseClient): Promise<boolean> {
  const header = req.headers.get("x-orkesta-cron") ?? ""
  if (header.length < 32) return false
  const secret = await cronSecret(admin)
  return secret.length >= 32 && timingSafeEqual(header, secret)
}
