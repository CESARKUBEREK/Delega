// Ejecuciones programadas: runs-cron llama a launchScheduled() cada minuto.
// flows_due() devuelve las automatizaciones que tocan y ya ha avanzado su
// próxima ejecución, así que cada una se lanza una sola vez.
//
// - No se lanzan las que se perdieron hace más de 6 horas (launch = false).
// - Máximo 20 ejecuciones programadas por espacio en 24 horas.
// - Si las 3 últimas ejecuciones programadas de un flujo fallaron, se pausa y
//   se avisa a quien lo creó.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { createRun } from "./agent.ts"
import { isUuid } from "./core.ts"
import { resolveAi } from "./llm.ts"
import { sendPush } from "./push.ts"

export const MAX_SCHEDULED_PER_DAY = 20
const FAILURES_TO_PAUSE = 3

type DueFlow = {
  id: string
  workspace_id: string
  name: string
  definition: Record<string, unknown>
  settings: Record<string, unknown> | null
  created_by: string | null
  scheduled_for: string
  launch: boolean
}

export async function launchScheduled(admin: SupabaseClient, limit = 10): Promise<{ launched: number; skipped: number }> {
  const { data, error } = await admin.rpc("flows_due", { p_limit: limit })
  if (error) {
    console.error("flows_due", error.code)
    return { launched: 0, skipped: 0 }
  }
  let launched = 0
  let skipped = 0
  for (const flow of (data ?? []) as DueFlow[]) {
    try {
      if (await launchOne(admin, flow)) launched++
      else skipped++
    } catch (e) {
      skipped++
      console.error("schedule launch", e instanceof Error ? e.name : "error")
    }
  }
  return { launched, skipped }
}

async function launchOne(admin: SupabaseClient, flow: DueFlow): Promise<boolean> {
  if (!flow.launch) return false

  // ¿Fallaron las últimas ejecuciones programadas? Entonces se pausa.
  const { data: recent } = await admin
    .from("flow_runs")
    .select("status")
    .eq("flow_id", flow.id)
    .eq("trigger->>type", "schedule")
    .order("started_at", { ascending: false })
    .limit(FAILURES_TO_PAUSE)
  if ((recent ?? []).length === FAILURES_TO_PAUSE && recent!.every((r) => r.status === "failed")) {
    await admin.from("flows").update({ status: "paused" }).eq("id", flow.id)
    if (flow.created_by) {
      await sendPush(admin, [flow.created_by], {
        title: "Automatización pausada",
        body: `«${flow.name.slice(0, 80)}» ha fallado ${FAILURES_TO_PAUSE} veces seguidas. Revísala y vuelve a activarla.`,
        url: `/w/${flow.workspace_id}/automatizaciones/${flow.id}`,
        tag: `paused-${flow.id}`,
      }).catch(() => undefined)
    }
    return false
  }

  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", flow.workspace_id)
    .eq("trigger->>type", "schedule")
    .gte("started_at", since)
  if ((count ?? 0) >= MAX_SCHEDULED_PER_DAY) return false

  const settings = flow.settings ?? {}
  const conn = await resolveAi(admin, flow.workspace_id, typeof settings.model === "string" ? settings.model : null)
  if (!conn) return false
  const fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter(isUuid).slice(0, 5) : []
  await createRun(admin, {
    workspaceId: flow.workspace_id,
    flow: { id: flow.id, name: flow.name, definition: flow.definition },
    fileIds,
    note: "",
    model: conn.model,
    startedBy: flow.created_by,
    trigger: { type: "schedule", scheduled_for: flow.scheduled_for },
  })
  return true
}
