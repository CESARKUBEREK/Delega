import "server-only"
import { createClient } from "@/lib/supabase/server"

// Planes de prueba del onboarding (decisión de Cesar, 3 nov): mientras el
// espacio no tenga IA propia, el onboarding prepara el plan con un modelo
// económico (GPT-6 Luna) y la clave de MarchaSolo, como mucho 2 veces
// por espacio personal. Nada más usa esta clave: el chat, la bandeja y las
// automatizaciones necesitan la IA del cliente.
// Devuelve null si el espacio no tiene planes de prueba o si la prueba no está
// activada en el servidor: TRIAL_CREDITS_ENABLED=true en Vercel, junto con
// TRIAL_OPENAI_API_KEY en las Edge Functions de Supabase.
export type TrialStatus = { allowance: number; used: number; remaining: number; exhausted: boolean }

export async function getTrialStatus(workspaceId: string): Promise<TrialStatus | null> {
  if (process.env.TRIAL_CREDITS_ENABLED !== "true") return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("workspace_trial_credits")
    .select("allowance_plans, used_plans, allowance_tokens, used_tokens")
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!data) return null
  const allowance = Number(data.allowance_plans)
  const used = Number(data.used_plans)
  const remaining = Math.max(0, allowance - used)
  return {
    allowance,
    used,
    remaining,
    exhausted: remaining <= 0 || Number(data.used_tokens) >= Number(data.allowance_tokens),
  }
}
