// mail-cron: lectura automática del correo IMAP de todos los espacios.
// La llama pg_cron cada 5 minutos (ver README). Se despliega SIN verify_jwt y
// exige la cabecera x-orkesta-cron con el secreto MAIL_CRON_SECRET.
// Recorre primero las cuentas que llevan más tiempo sin leerse. Los correos
// nuevos lanzan las automatizaciones «al llegar un correo» (las avanza runs-cron).
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { syncImap } from "../_shared/imap.ts"
import { launchEmailFlows } from "../_shared/triggers.ts"
import { runInBackground } from "../_shared/background.ts"

const BUDGET_MS = 110_000

function serviceKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // variable heredada
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
}

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const secret = Deno.env.get("MAIL_CRON_SECRET") ?? ""
  if (secret.length < 32 || !timingSafeEqual(req.headers.get("x-orkesta-cron") ?? "", secret)) {
    return new Response("Forbidden", { status: 403 })
  }

  return runInBackground("mail-cron", syncAll)
})

async function syncAll() {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: due } = await admin.rpc("mail_integrations_due", { p_limit: 30 })
  const deadline = Date.now() + BUDGET_MS
  let done = 0
  let failed = 0
  let launched = 0
  for (const item of (due ?? []) as { workspace_id: string; provider: string }[]) {
    // Cada cuenta, como mucho 30 s; lo que falte se lee en la siguiente vuelta.
    const slice = Math.min(deadline, Date.now() + 30_000)
    if (Date.now() > deadline - 5_000) break
    try {
      const r = await syncImap(admin, item.workspace_id, slice)
      launched += await launchEmailFlows(admin, item.workspace_id, r.fresh).catch((e) => {
        console.error("mail-cron launch", e instanceof Error ? e.name : "error")
        return 0
      })
      done++
    } catch (e) {
      failed++
      console.error("mail-cron", item.provider, e instanceof Error ? e.name : "error")
      // Para no reintentar enseguida una cuenta que falla, se apunta la hora del intento.
      const { data: integ } = await admin
        .from("integrations")
        .select("config")
        .eq("workspace_id", item.workspace_id)
        .eq("provider", item.provider)
        .maybeSingle()
      await admin.rpc("integration_set_config", {
        p_workspace_id: item.workspace_id,
        p_provider: item.provider,
        p_config: { ...((integ?.config ?? {}) as Record<string, unknown>), last_sync_at: new Date().toISOString() },
      })
    }
  }
  return { done, failed, launched }
}
