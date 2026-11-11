import "server-only"
import { createClient } from "@/lib/supabase/server"

// IA incluida en el plan (decisión del 11 nov): tareas del periodo vigente.
// Devuelve null si el espacio no tiene un periodo abierto (sin plan o con la
// prueba gratuita). La RLS deja leerlo a los miembros del espacio.
export type IncludedUsage = {
  planCode: string | null
  periodEnd: string
  tasksAllowance: number
  tasksUsed: number
  tasksLeft: number
  // Aviso del 80 % y pausa del 100 % (de tareas o del tope en USD).
  nearLimit: boolean
  exhausted: boolean
}

export async function getIncludedUsage(workspaceId: string): Promise<IncludedUsage | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data } = await supabase
    .from("workspace_usage_periods")
    .select("plan_code, period_end, tasks_allowance, extra_tasks, tasks_used, usd_cap, usd_used")
    .eq("workspace_id", workspaceId)
    .lte("period_start", now)
    .gt("period_end", now)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return usageFromRow(data)
}

export function usageFromRow(row: {
  plan_code: string | null
  period_end: string
  tasks_allowance: number
  extra_tasks: number
  tasks_used: number
  usd_cap: number
  usd_used: number
}): IncludedUsage {
  const allowance = Number(row.tasks_allowance) + Number(row.extra_tasks)
  const used = Math.floor(Number(row.tasks_used))
  const exhausted = used >= allowance || Number(row.usd_used) >= Number(row.usd_cap)
  return {
    planCode: row.plan_code,
    periodEnd: row.period_end,
    tasksAllowance: allowance,
    tasksUsed: used,
    tasksLeft: Math.max(0, allowance - used),
    nearLimit: !exhausted && used >= allowance * 0.8,
    exhausted,
  }
}
