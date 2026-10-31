// runs-cron: lanza las automatizaciones programadas que tocan y avanza las
// ejecuciones que nadie está mirando (las lanzadas por un
// correo o por Telegram, o las que se quedaron a medias al cerrar el móvil).
// La llama pg_cron cada minuto (ver README). Se despliega SIN verify_jwt y exige
// la cabecera x-orkesta-cron con el secreto de Vault «orkesta_mail_cron_secret» (ver _shared/cron.ts).
//
// Cada vuelta toma hasta 3 ejecuciones en estado «running» sin lease vigente,
// de las últimas 24 h, y avanza cada una un tramo de 50 s en paralelo. El lease
// impide que dos procesos avancen a la vez la misma ejecución. Las que llevan
// más de 24 h sin terminar se dan por fallidas. Lo que quieran
// escribir o enviar se queda esperando aprobación, como siempre.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim } from "../_shared/agent.ts"
import { launchScheduled } from "../_shared/schedule.ts"
import { runInBackground } from "../_shared/background.ts"
import { cronAuthorized } from "../_shared/cron.ts"
import { upgradeTelegramWebhooks } from "../_shared/telegram-notice.ts"
import { classifyPending } from "../_shared/inbox-classify.ts"
import { autoPrepare } from "../_shared/inbox-prepare.ts"

const PER_CALL = 3
const SLICE_MS = 50_000
// Bandeja: clasificar y preparar respuestas, en paralelo con las ejecuciones.
const INBOX_MS = 45_000
const INBOX_WORKSPACES = 3

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


Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await cronAuthorized(req, admin))) return new Response("Forbidden", { status: 403 })

  return runInBackground("runs-cron", () => tick(admin))
})

async function tick(admin: SupabaseClient) {
  const scheduled = await launchScheduled(admin)
  const stale = await failStale(admin)
  const webhooks = await upgradeTelegramWebhooks(admin).catch(() => 0)

  const now = new Date().toISOString()
  const { data: due } = await admin
    .from("flow_runs")
    .select("id")
    .eq("status", "running")
    .or(`lease_until.is.null,lease_until.lt.${now}`)
    .gte("started_at", new Date(Date.now() - 86_400_000).toISOString())
    .order("updated_at")
    .limit(PER_CALL)

  const inbox = inboxTick(admin).catch((e) => {
    console.error("runs-cron inbox", e instanceof Error ? e.name : "error")
    return null
  })
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
  return { scheduled, stale, webhooks, runs: results, inbox: await inbox }
}

// Clasifica lo que ha llegado (sin pulsar nada) y prepara las respuestas que
// lo merecen. Primero los espacios que más esperan.
async function inboxTick(admin: SupabaseClient) {
  const deadline = Date.now() + INBOX_MS
  const { data } = await admin.rpc("inbox_workspaces_pending", { p_limit: INBOX_WORKSPACES })
  const pending = ((data ?? []) as { workspace_id: string }[]).map((r) => r.workspace_id)
  let classified = 0
  for (const workspaceId of pending) {
    if (Date.now() > deadline - 10_000) break
    const r = await classifyPending(admin, workspaceId, { deadline: Math.min(deadline, Date.now() + 25_000) })
    classified += r.classified
  }
  // Preparar respuestas: en los espacios con correo conectado y algo que responder.
  const { data: ws } = await admin
    .from("inbox_threads")
    .select("workspace_id")
    .eq("needs_reply", true)
    .eq("last_direction", "in")
    .is("prepare_run_id", null)
    .is("prepare_dismissed_at", null)
    .eq("archived", false)
    .gte("last_message_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
    .limit(50)
  let prepared = 0
  for (const workspaceId of [...new Set((ws ?? []).map((r) => r.workspace_id as string))].slice(0, 5)) {
    if (Date.now() > deadline) break
    prepared += await autoPrepare(admin, workspaceId).catch(() => 0)
  }
  return { classified, prepared }
}

// Ejecuciones «en marcha» de hace más de 24 h que ya no avanzan: se dan por
// fallidas para que no queden colgadas para siempre.
async function failStale(admin: SupabaseClient): Promise<number> {
  const { data } = await admin
    .from("flow_runs")
    .update({
      status: "failed",
      error: "Se detuvo: llevaba más de 24 horas sin terminar.",
      finished_at: new Date().toISOString(),
      lease_until: null,
    })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 86_400_000).toISOString())
    .or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`)
    .select("id")
  return data?.length ?? 0
}
