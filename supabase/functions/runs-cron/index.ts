// runs-cron: avanza las ejecuciones que nadie está mirando (las lanzadas por un
// correo o por Telegram, o las que se quedaron a medias al cerrar el móvil).
// La llama pg_cron cada minuto (ver README). Se despliega SIN verify_jwt y exige
// la cabecera x-orkesta-cron con el secreto MAIL_CRON_SECRET.
//
// Cada vuelta toma hasta 3 ejecuciones en estado «running» sin lease vigente,
// de las últimas 24 h, y avanza cada una un tramo de 50 s en paralelo. El lease
// impide que dos procesos avancen a la vez la misma ejecución. Lo que quieran
// escribir o enviar se queda esperando aprobación, como siempre.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim } from "../_shared/agent.ts"

const PER_CALL = 3
const SLICE_MS = 50_000

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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  const now = new Date().toISOString()
  const { data: due } = await admin
    .from("flow_runs")
    .select("id")
    .eq("status", "running")
    .or(`lease_until.is.null,lease_until.lt.${now}`)
    .gte("started_at", new Date(Date.now() - 86_400_000).toISOString())
    .order("updated_at")
    .limit(PER_CALL)

  const results = await Promise.all(
    (due ?? []).map(async ({ id }) => {
      try {
        const run = await claim(admin, id, "running")
        if (!run) return "busy"
        return await advance(admin, run, SLICE_MS)
      } catch (e) {
        console.error("runs-cron", e instanceof Error ? e.name : "error")
        return "error"
      }
    }),
  )
  return new Response(JSON.stringify({ ok: true, runs: results }), { headers: { "Content-Type": "application/json" } })
})
