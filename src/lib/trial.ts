import "server-only"
import { createClient } from "@/lib/supabase/server"

// Créditos de IA de prueba del espacio (solo espacios personales; los usa el
// chat y el onboarding cuando no hay IA propia). Devuelve null si no hay
// créditos en este espacio o si la prueba no está activada en el servidor:
// TRIAL_CREDITS_ENABLED=true en Vercel, junto con TRIAL_LLM_API_KEY en las
// Edge Functions de Supabase.
export type TrialStatus = { allowance: number; used: number; remaining: number; pctLeft: number; exhausted: boolean }

export async function getTrialStatus(workspaceId: string): Promise<TrialStatus | null> {
  if (process.env.TRIAL_CREDITS_ENABLED !== "true") return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("workspace_trial_credits")
    .select("allowance_tokens, used_tokens")
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!data) return null
  const allowance = Number(data.allowance_tokens)
  const used = Number(data.used_tokens)
  const remaining = Math.max(0, allowance - used)
  return {
    allowance,
    used,
    remaining,
    pctLeft: allowance > 0 ? Math.round((remaining / allowance) * 100) : 0,
    exhausted: remaining <= 0,
  }
}
