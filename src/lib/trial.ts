import "server-only"
import { createClient } from "@/lib/supabase/server"

// Créditos de prueba financiados por MarchaSolo (TRIAL_OPENAI_API_KEY).
// Planes del onboarding: máx. 2. Ejecuciones (manuales, programadas o por
// disparador): hasta allowance_usd (1 USD) de gasto, solo sin IA propia.
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
  usdAllowance: number
  usdUsed: number
  usdRemaining: number
  // Fin de la prueba (14 días o 1 USD, lo que llegue antes; decisión del 11 nov).
  expiresAt: string | null
  expired: boolean
}

export async function getTrialStatus(workspaceId: string): Promise<TrialStatus | null> {
  if (process.env.TRIAL_CREDITS_ENABLED !== "true") return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("workspace_trial_credits")
    .select("allowance_plans, used_plans, allowance_runs, used_runs, allowance_tokens, used_tokens, allowance_usd, used_usd, expires_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!data) return null
  const allowance = Number(data.allowance_plans)
  const used = Number(data.used_plans)
  const remaining = Math.max(0, allowance - used)
  const runsAllowance = Number(data.allowance_runs)
  const runsUsed = Number(data.used_runs)
  const runsRemaining = Math.max(0, runsAllowance - runsUsed)
  const usdAllowance = Number(data.allowance_usd)
  const usdUsed = Number(data.used_usd)
  const expiresAt = data.expires_at ?? null
  const expired = expiresAt !== null && new Date(expiresAt).getTime() <= Date.now()
  const usdRemaining = expired ? 0 : Math.max(0, Math.round((usdAllowance - usdUsed) * 100) / 100)
  const tokensAvailable = Number(data.used_tokens) < Number(data.allowance_tokens)
  return {
    allowance,
    used,
    remaining,
    exhausted: remaining <= 0 || !tokensAvailable,
    runsAllowance,
    runsUsed,
    runsRemaining,
    // Desde el 7 nov las ejecuciones gratuitas se limitan por gasto, no por número.
    runAvailable: usdRemaining > 0,
    usdAllowance,
    usdUsed,
    usdRemaining,
    expiresAt,
    expired,
  }
}
