import "server-only"
import { createClient } from "@/lib/supabase/server"

// Créditos de prueba financiados por MarchaSolo.
// Los planes del onboarding y la ejecución manual gratuita usan
// TRIAL_OPENAI_API_KEY; la ejecución consume un cupo independiente.
// Las automatizaciones programadas nunca usan el crédito de ejecución.
// Devuelve null si la prueba de planes no está habilitada en Vercel o no hay fila.
export type TrialStatus = {
  allowance: number
  used: number
  remaining: number
  exhausted: boolean
  runsAllowance: number
  runsUsed: number
  runsRemaining: number
  runAvailable: boolean
}

export async function getTrialStatus(workspaceId: string): Promise<TrialStatus | null> {
  if (process.env.TRIAL_CREDITS_ENABLED !== "true") return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("workspace_trial_credits")
    .select("allowance_plans, used_plans, allowance_runs, used_runs, allowance_tokens, used_tokens, reserved_run_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!data) return null
  const allowance = Number(data.allowance_plans)
  const used = Number(data.used_plans)
  const remaining = Math.max(0, allowance - used)
  const runsAllowance = Number(data.allowance_runs)
  const runsUsed = Number(data.used_runs)
  const runsRemaining = Math.max(0, runsAllowance - runsUsed)
  const tokensAvailable = Number(data.used_tokens) < Number(data.allowance_tokens)
  return {
    allowance,
    used,
    remaining,
    exhausted: remaining <= 0 || !tokensAvailable,
    runsAllowance,
    runsUsed,
    runsRemaining,
    runAvailable: runsRemaining > 0 && tokensAvailable && data.reserved_run_id == null,
  }
}
