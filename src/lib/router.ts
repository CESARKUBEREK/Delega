// Router de IA (fase 8): la parte pura, compartida con las Edge Functions.
// La app la usa para mostrar el modo, el coste estimado y el motivo.
export {
  autoRunBudget,
  costUsd,
  FALLBACK_CATALOG,
  formatUsd,
  isMode,
  type Mode,
  MODE_LABEL,
  type ModelInfo,
  MODES,
  rankModels,
  type RoutePlan,
  RUN_BUDGET_DEFAULT,
  type Task,
  TASKS,
  toModelInfo,
} from "../../supabase/functions/_shared/router/core"

import { isMode, type Mode } from "../../supabase/functions/_shared/router/core"

export const MODE_HINT: Record<Mode, string> = {
  eco: "El modelo más barato que sirve para cada tarea.",
  smart: "Elige según la tarea: el económico para lo sencillo y tu modelo principal para lo demás.",
  expert: "Los modelos más capaces para lo que razona o escribe a tus clientes. Cuesta más.",
}

export const TASK_LABEL: Record<string, string> = {
  classify: "Clasificar la bandeja",
  summarize: "Resúmenes",
  help: "Ayudante",
  plan: "Chat y editor",
  draft_reply: "Respuestas preparadas",
  agent: "Automatizaciones",
  review: "Revisiones",
  transcribe: "Dictado",
  other: "Otros",
}

export type WorkspaceRouting = {
  mode: Mode
  crossProvider: boolean
  stopAtLimit: boolean
  dailyUsd: number | null
  monthlyUsd: number | null
  runUsd: number | null
}

export function readWorkspaceRouting(value: unknown): WorkspaceRouting {
  const v = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>
  const usd = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null)
  return {
    mode: isMode(v.mode) ? v.mode : "smart",
    crossProvider: v.cross_provider === true,
    stopAtLimit: v.stop_at_limit === true,
    dailyUsd: usd(v.daily_usd),
    monthlyUsd: usd(v.monthly_usd),
    runUsd: usd(v.run_usd),
  }
}

// flows.settings.routing = { mode?, run_usd? }; flows.settings.model = fijo.
export function readFlowRouting(settings: unknown): { mode: Mode | null; runUsd: number | null; fixedModel: string | null } {
  const s = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>
  const r = (s.routing && typeof s.routing === "object" ? s.routing : {}) as Record<string, unknown>
  return {
    mode: isMode(r.mode) ? r.mode : null,
    runUsd: typeof r.run_usd === "number" && r.run_usd > 0 ? r.run_usd : null,
    fixedModel: typeof s.model === "string" && s.model ? s.model : null,
  }
}

// «1,5» o «1.5» → 1.5; vacío → null; fuera de rango → undefined (error).
export function parseUsdInput(raw: FormDataEntryValue | null): number | null | undefined {
  const text = String(raw ?? "").trim().replace(",", ".")
  if (!text) return null
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0.01 || n > 100000) return undefined
  return Math.round(n * 100) / 100
}
