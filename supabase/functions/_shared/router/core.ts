// Smart LLM Router (fase 8-1): la parte pura, sin red ni base de datos.
// La usan las Edge Functions (Deno) y la app (Next, para la vista previa del
// costo), así que no importa nada.
//
// Un solo motor: los modos (Ahorro, Inteligente, Máxima calidad) son pesos y
// reglas distintos de la misma función, rankModels().

export type RouterProvider = "openai" | "anthropic" | "deepseek" | "xai"
export type Tier = "economy" | "standard" | "premium"
export type Mode = "eco" | "smart" | "expert"
export type Task = "classify" | "summarize" | "help" | "plan" | "draft_reply" | "agent" | "review"
export type Capability = "tools" | "json" | "reasoning" | "vision"

export const MODES: Mode[] = ["eco", "smart", "expert"]
export const MODE_LABEL: Record<Mode, string> = { eco: "Ahorro", smart: "Inteligente", expert: "Máxima calidad" }

export function isMode(v: unknown): v is Mode {
  return typeof v === "string" && (MODES as string[]).includes(v)
}

// ---------------------------------------------------------------------------
// Catálogo (la fuente es la tabla llm_models; esto es la copia de reserva si
// la tabla no responde, con los mismos precios de la migración).
// ---------------------------------------------------------------------------
export type ModelInfo = {
  model: string
  provider: string
  label: string
  tier: Tier
  quality_prior: number | null
  price_in: number
  price_cached_in: number | null
  price_cache_write: number | null
  price_out: number
  long_context_threshold: number | null
  long_price_in: number | null
  long_price_cached_in: number | null
  long_price_out: number | null
  context_tokens: number | null
  capabilities: string[]
  latency: "fast" | "normal" | "slow"
  status: "active" | "degraded" | "deprecated"
  prices_updated_at: string
}

const m = (
  model: string,
  provider: RouterProvider,
  label: string,
  tier: Tier,
  p: [number, number | null, number | null, number],
  extra: Partial<ModelInfo> = {},
): ModelInfo => ({
  model,
  provider,
  label,
  tier,
  quality_prior: null,
  price_in: p[0],
  price_cached_in: p[1],
  price_cache_write: p[2],
  price_out: p[3],
  long_context_threshold: null,
  long_price_in: null,
  long_price_cached_in: null,
  long_price_out: null,
  context_tokens: null,
  capabilities: ["tools", "json"],
  latency: tier === "economy" ? "fast" : tier === "premium" ? "slow" : "normal",
  status: "active",
  prices_updated_at: "2026-11-02",
  ...extra,
})

export const FALLBACK_CATALOG: ModelInfo[] = [
  m("gpt-6-luna", "openai", "GPT-6 Luna", "economy", [0.1, 0.01, null, 0.5]),
  m("gpt-6.1-sol", "openai", "GPT-6.1 Sol", "standard", [2, 0.1, null, 10]),
  m("gpt-6-astra", "openai", "GPT-6 Astra", "premium", [10, 1, null, 50]),
  m("claude-haiku-5-5", "anthropic", "Claude Haiku 5.5", "economy", [0.1, 0.01, 0.125, 0.5], {
    long_context_threshold: 100_000,
    long_price_in: 0.5,
    long_price_cached_in: 0.05,
    long_price_out: 2.5,
  }),
  m("claude-sonnet-5-5", "anthropic", "Claude Sonnet 5.5", "standard", [2, 0.1, 2.5, 10], { context_tokens: 1_000_000 }),
  m("claude-opus-5-5", "anthropic", "Claude Opus 5.5", "premium", [4, 0.2, 5, 20], { context_tokens: 1_000_000 }),
  m("claude-fable-5-1", "anthropic", "Claude Fable 5.1", "premium", [10, 0.25, 12.5, 50], { context_tokens: 1_000_000 }),
  m("deepseek-flash", "deepseek", "DeepSeek V4.1 Flash", "economy", [0.3, 0.006, null, 1.2], { context_tokens: 1_000_000 }),
  m("deepseek-v4-pro", "deepseek", "DeepSeek V4 Pro", "standard", [1.32, 0.044, null, 3.96], { context_tokens: 1_000_000 }),
  m("grok-4.7", "xai", "Grok 4.7", "standard", [2, 0.5, null, 6], {
    context_tokens: 500_000,
    long_context_threshold: 200_000,
    long_price_in: 4,
    long_price_cached_in: 1,
    long_price_out: 12,
  }),
]

// Normaliza una fila de llm_models (los numeric pueden llegar como texto).
export function toModelInfo(row: Record<string, unknown>): ModelInfo | null {
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null)
  const model = typeof row.model === "string" ? row.model : ""
  const tier = row.tier
  if (!model || (tier !== "economy" && tier !== "standard" && tier !== "premium")) return null
  const priceIn = num(row.price_in)
  const priceOut = num(row.price_out)
  if (priceIn === null || priceOut === null) return null
  const latency = row.latency === "fast" || row.latency === "slow" ? row.latency : "normal"
  const status = row.status === "degraded" || row.status === "deprecated" ? row.status : "active"
  return {
    model,
    provider: String(row.provider ?? ""),
    label: typeof row.label === "string" ? row.label : model,
    tier,
    quality_prior: num(row.quality_prior),
    price_in: priceIn,
    price_cached_in: num(row.price_cached_in),
    price_cache_write: num(row.price_cache_write),
    price_out: priceOut,
    long_context_threshold: num(row.long_context_threshold),
    long_price_in: num(row.long_price_in),
    long_price_cached_in: num(row.long_price_cached_in),
    long_price_out: num(row.long_price_out),
    context_tokens: num(row.context_tokens),
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter((c): c is string => typeof c === "string") : [],
    latency,
    status,
    prices_updated_at: typeof row.prices_updated_at === "string" ? row.prices_updated_at : "",
  }
}

// ---------------------------------------------------------------------------
// Costo
// ---------------------------------------------------------------------------
// input incluye los tokens en caché y los escritos en caché (como los cuenta
// llm.ts); reasoning va dentro de output (los proveedores lo cobran como salida).
export type TokenUsage = { input: number; output: number; cached?: number; cacheWrite?: number; reasoning?: number }

export function costUsd(info: ModelInfo | null | undefined, u: TokenUsage): number {
  if (!info) return 0
  const input = Math.max(0, u.input || 0)
  const cached = Math.min(input, Math.max(0, u.cached || 0))
  const cacheWrite = Math.min(input - cached, Math.max(0, u.cacheWrite || 0))
  const fresh = input - cached - cacheWrite
  const long = info.long_context_threshold !== null && input >= info.long_context_threshold
  const pIn = long && info.long_price_in !== null ? info.long_price_in : info.price_in
  const pOut = long && info.long_price_out !== null ? info.long_price_out : info.price_out
  const pCached = long && info.long_price_cached_in !== null ? info.long_price_cached_in : info.price_cached_in ?? pIn
  const pWrite = info.price_cache_write !== null ? info.price_cache_write * (pIn / info.price_in || 1) : pIn
  const usd = (fresh * pIn + cached * pCached + cacheWrite * pWrite + Math.max(0, u.output || 0) * pOut) / 1_000_000
  return Math.round(usd * 1_000_000) / 1_000_000
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------
export type TaskProfile = {
  label: string
  needs: Capability[]
  minTier: Tier
  // 1–5. Por debajo de 3, la calidad por encima de lo necesario no puntúa.
  complexity: number
  // Tokens de una llamada típica, parte de la entrada que sale de la caché y
  // llamadas por tarea (para estimar y comparar costos). Calibrado el 3 nov
  // con usage_events de producción (agent: 21 llamadas en 6 ejecuciones;
  // classify: 17; draft_reply: 4; plan: 1). Sin datos aún: summarize, help y
  // review (valores de partida). Recalibrar cuando haya más (8-4).
  typicalIn: number
  typicalOut: number
  cachedShare: number
  calls: number
}

export const TASKS: Record<Task, TaskProfile> = {
  classify: { label: "clasificar la bandeja", needs: ["json"], minTier: "economy", complexity: 1, typicalIn: 1000, typicalOut: 200, cachedShare: 0, calls: 1 },
  summarize: { label: "resumir", needs: [], minTier: "economy", complexity: 2, typicalIn: 6000, typicalOut: 800, cachedShare: 0, calls: 1 },
  help: { label: "responder dudas", needs: ["json"], minTier: "economy", complexity: 1, typicalIn: 4000, typicalOut: 500, cachedShare: 0, calls: 1 },
  plan: { label: "diseñar automatizaciones", needs: ["json"], minTier: "standard", complexity: 3, typicalIn: 4000, typicalOut: 1100, cachedShare: 0, calls: 1 },
  draft_reply: { label: "redactar respuestas", needs: [], minTier: "standard", complexity: 2, typicalIn: 7000, typicalOut: 450, cachedShare: 0.35, calls: 1 },
  agent: { label: "trabajar con tus herramientas", needs: ["tools"], minTier: "standard", complexity: 3, typicalIn: 6000, typicalOut: 250, cachedShare: 0.55, calls: 4 },
  review: { label: "revisar propuestas", needs: ["json"], minTier: "standard", complexity: 2, typicalIn: 5000, typicalOut: 400, cachedShare: 0, calls: 1 },
}

// ---------------------------------------------------------------------------
// Puntuación
// ---------------------------------------------------------------------------
// Pesos iniciales del documento (§7.1). Calibrables con datos reales (8-4).
export const WEIGHTS: Record<Mode, { q: number; c: number; l: number; r: number }> = {
  eco: { q: 0.2, c: 0.5, l: 0.15, r: 0.15 },
  smart: { q: 0.4, c: 0.25, l: 0.15, r: 0.2 },
  expert: { q: 0.6, c: 0.05, l: 0.05, r: 0.3 },
}
const TIER_RANK: Record<Tier, number> = { economy: 0, standard: 1, premium: 2 }
const TIER_QUALITY: Record<Tier, number> = { economy: 55, standard: 75, premium: 90 }
const LATENCY_SCORE: Record<ModelInfo["latency"], number> = { fast: 90, normal: 70, slow: 50 }
// Calidad máxima que cuenta en tareas sencillas (complejidad < 3).
const SIMPLE_TASK_QUALITY_CAP = 60
// Ventaja del modelo que la persona eligió para cada IA conectada.
const PREFERRED_BONUS = 8
// Fiabilidad de partida hasta que haya resultados (8-4).
const DEFAULT_RELIABILITY = 90

export type Connection = { provider: string; model: string; isDefault: boolean }

export type RouteInput = {
  catalog: ModelInfo[]
  // IAs conectadas y activas del espacio, con el modelo que eligió la persona.
  connections: Connection[]
  task: Task
  mode: Mode
  // Modelo fijado a mano (automatización): manda si su proveedor está conectado.
  fixedModel?: string | null
  // Usar también las IAs que no son la principal (si no, solo de respaldo).
  crossProvider?: boolean
  complexity?: number
  needsTools?: boolean
  inputTokens?: number
  // Fiabilidad observada por modelo (0–100), cuando la haya.
  reliability?: Record<string, number>
}

export type ScoredModel = { model: string; provider: string; tier: Tier; score: number; costUsd: number }

export type RoutePlan = {
  task: Task
  mode: Mode
  fixed: boolean
  primary: string
  fallbacks: string[]
  estimatedCostUsd: number
  reason: string
  scores: ScoredModel[]
}

function taskCost(info: ModelInfo, profile: TaskProfile, inputTokens?: number): number {
  const input = inputTokens && inputTokens > 0 ? inputTokens : profile.typicalIn
  // Los proveedores sin precio de caché cobran esa parte como entrada normal (costUsd).
  const cached = Math.round(input * profile.cachedShare)
  return costUsd(info, { input, cached, output: profile.typicalOut }) * profile.calls
}

function scoreAll(
  models: ModelInfo[],
  input: RouteInput,
  profile: TaskProfile,
  preferred: Set<string>,
  complexity: number,
): ScoredModel[] {
  const w = WEIGHTS[input.mode]
  const costs = models.map((info) => Math.max(taskCost(info, profile, input.inputTokens), 1e-9))
  const lo = Math.log(Math.min(...costs))
  const hi = Math.log(Math.max(...costs))
  return models.map((info, i) => {
    let q = info.quality_prior ?? TIER_QUALITY[info.tier]
    if (complexity < 3) q = Math.min(q, SIMPLE_TASK_QUALITY_CAP)
    const c = hi - lo < 1e-9 ? 100 : (100 * (hi - Math.log(costs[i]))) / (hi - lo)
    const l = LATENCY_SCORE[info.latency]
    const r = input.reliability?.[info.model] ?? DEFAULT_RELIABILITY
    const score = w.q * q + w.c * c + w.l * l + w.r * r + (preferred.has(info.model) ? PREFERRED_BONUS : 0)
    return { model: info.model, provider: info.provider, tier: info.tier, score: Math.round(score * 10) / 10, costUsd: costs[i] }
  })
}

function reasonFor(input: RouteInput, profile: TaskProfile, chosen: ModelInfo, preferred: Set<string>, fixed: boolean): string {
  if (fixed) return `Modelo elegido a mano para esta automatización (${chosen.label}).`
  const what = preferred.has(chosen.model)
    ? "tu modelo principal"
    : chosen.tier === "economy"
    ? "un modelo económico"
    : chosen.tier === "premium"
    ? "el modelo más capaz"
    : "un modelo intermedio"
  const why = input.mode === "eco"
    ? "el más barato que sirve"
    : input.mode === "expert"
    ? "prima la calidad"
    : chosen.tier === "economy"
    ? "basta para esta tarea"
    : "equilibrio entre calidad y costo"
  return `${MODE_LABEL[input.mode]}: ${what} (${chosen.label}) para ${profile.label}; ${why}.`
}

// Elige el modelo principal y el respaldo. Devuelve null si no hay ninguno
// que sirva con las IAs conectadas.
export function rankModels(input: RouteInput): RoutePlan | null {
  const profile = TASKS[input.task]
  const complexity = input.complexity ?? profile.complexity
  const needs = new Set<string>(profile.needs)
  if (input.needsTools) needs.add("tools")
  const providers = new Set(input.connections.map((c) => c.provider))
  const preferred = new Set(input.connections.map((c) => c.model))
  const main = input.connections.find((c) => c.isDefault)?.provider ?? input.connections[0]?.provider

  const usable = input.catalog.filter((info) =>
    providers.has(info.provider) &&
    info.status !== "deprecated" &&
    [...needs].every((n) => info.capabilities.includes(n)) &&
    (!info.context_tokens || !input.inputTokens || info.context_tokens >= input.inputTokens * 1.1)
  )
  const healthy = usable.filter((info) => info.status === "active")
  const all = healthy.length ? healthy : usable
  if (!all.length) return null

  const fixedInfo = input.fixedModel ? all.find((info) => info.model === input.fixedModel) : undefined

  let primary: ModelInfo
  let scored: ScoredModel[]
  if (fixedInfo) {
    primary = fixedInfo
    scored = scoreAll(all, input, profile, preferred, complexity)
  } else {
    const pool = input.crossProvider ? all : all.filter((info) => info.provider === main)
    const base = pool.length ? pool : all
    const minTier: Tier = input.mode === "expert" && complexity >= 3 ? "premium" : profile.minTier
    // El modelo que eligió la persona siempre puede usarse (salvo en Máxima calidad).
    let eligible = base.filter((info) =>
      TIER_RANK[info.tier] >= TIER_RANK[minTier] || (input.mode !== "expert" && preferred.has(info.model))
    )
    if (!eligible.length) {
      // Nada llega al mínimo: lo mejor que haya.
      const best = Math.max(...base.map((info) => TIER_RANK[info.tier]))
      eligible = base.filter((info) => TIER_RANK[info.tier] === best)
    }
    scored = scoreAll(eligible, input, profile, preferred, complexity)
    const top = [...scored].sort((a, b) => b.score - a.score || a.costUsd - b.costUsd)[0]
    primary = eligible.find((info) => info.model === top.model)!
  }

  // Respaldo: primero de otros proveedores (si uno falla por saldo o caída,
  // los suyos suelen fallar igual), los que llegan al mínimo de la tarea y
  // por puntuación; como mucho 3.
  const allScores = scoreAll(all, input, profile, preferred, complexity)
  const fallbacks = allScores
    .filter((s) => s.model !== primary.model)
    .map((s) => ({
      s,
      other: s.provider !== primary.provider ? 1 : 0,
      meets: TIER_RANK[s.tier] >= TIER_RANK[profile.minTier] ? 1 : 0,
    }))
    .sort((a, b) => b.other - a.other || b.meets - a.meets || b.s.score - a.s.score)
    .slice(0, 3)
    .map((x) => x.s.model)

  return {
    task: input.task,
    mode: input.mode,
    fixed: Boolean(fixedInfo),
    primary: primary.model,
    fallbacks,
    estimatedCostUsd: Math.round(taskCost(primary, profile, input.inputTokens) * 1_000_000) / 1_000_000,
    reason: reasonFor(input, profile, primary, preferred, Boolean(fixedInfo)),
    scores: scored.sort((a, b) => b.score - a.score).slice(0, 6),
  }
}

// ---------------------------------------------------------------------------
// Presupuesto por ejecución
// ---------------------------------------------------------------------------
export const RUN_BUDGET_DEFAULT: Record<Mode, number> = { eco: 0.5, smart: 1, expert: 3 }
const RUN_BUDGET_MIN = 0.5
const RUN_BUDGET_MAX = 5

// «Automático»: 3 veces lo que suelen costar sus ejecuciones (entre 0,50 y
// 5 $); sin historial, según el modo.
export function autoRunBudget(mode: Mode, recentCosts: number[]): number {
  const costs = recentCosts.filter((c) => Number.isFinite(c) && c > 0)
  if (costs.length < 3) return RUN_BUDGET_DEFAULT[mode]
  const avg = costs.reduce((a, b) => a + b, 0) / costs.length
  return Math.round(Math.min(RUN_BUDGET_MAX, Math.max(RUN_BUDGET_MIN, avg * 3)) * 100) / 100
}

// Importe para mostrar: «0,0042 $», «1,20 $».
export function formatUsd(v: number): string {
  const n = Number(v) || 0
  const digits = n === 0 ? 2 : n < 0.01 ? 4 : n < 1 ? 3 : 2
  return `${n.toLocaleString("es-ES", { minimumFractionDigits: digits === 2 ? 2 : 0, maximumFractionDigits: digits })} $`
}
