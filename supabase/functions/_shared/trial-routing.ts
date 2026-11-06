// Selección pura de proveedores financiados por MarchaSolo para el onboarding.
// Las claves llegan desde secretos de Edge Functions y nunca se registran.
export type TrialProvider = "anthropic" | "deepseek"
export type TrialProviderConfig = {
  provider: TrialProvider
  model: string
  apiKey: string
  trial: true
}

export function resolveTrialProviders(
  anthropicKey: string | null | undefined,
  deepseekKey: string | null | undefined,
): { primary: TrialProviderConfig | null; fallback: TrialProviderConfig | null } {
  const anthropic = anthropicKey?.trim()
  const deepseek = deepseekKey?.trim()
  if (anthropic) {
    return {
      primary: { provider: "anthropic", model: "claude-sonnet-5-5", apiKey: anthropic, trial: true },
      fallback: deepseek ? { provider: "deepseek", model: "deepseek-flash", apiKey: deepseek, trial: true } : null,
    }
  }
  if (deepseek) {
    return {
      primary: { provider: "deepseek", model: "deepseek-flash", apiKey: deepseek, trial: true },
      fallback: null,
    }
  }
  return { primary: null, fallback: null }
}
