// Smart LLM Router (fase 8-1): decide qué modelo usa cada llamada a la IA.
//
// - routeAi(): para una tarea, el modelo principal y el respaldo, según el
//   modo del espacio (o de la automatización), las IAs conectadas y el
//   presupuesto. La clave de cada proveedor se descifra solo al usarla.
// - callRouted(): hace la llamada; si el proveedor falla por saldo, límite,
//   clave rechazada o caída, pasa al siguiente del respaldo. Registra el
//   consumo de cada llamada con su coste estimado.
// - planRun(): lo mismo para una ejecución del agente (modelo, respaldo y
//   presupuesto de la ejecución), que se guarda en flow_runs.
// - Presupuesto del espacio: al 80 % avisa; al 100 % pasa a Ahorro (o para,
//   si el espacio lo eligió) y avisa. Los avisos no llevan datos de clientes.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import {
  type Ai,
  isProvider,
  LlmError,
  markInvalidIfNeeded,
  NO_AI_MESSAGE,
  type Provider,
  recordUsage,
  resolveAiOrTrial,
  type StepType,
  type Usage,
} from "../llm.ts"
import { sendPush } from "../push.ts"
import { loadCatalog } from "./catalog.ts"
import { autoRunBudget, type Connection, formatUsd, isMode, type Mode, rankModels, type RoutePlan, type Task } from "./core.ts"

export type RoutingSettings = {
  mode: Mode
  learning: boolean
  cross_provider: boolean
  stop_at_limit: boolean
  daily_usd: number | null
  monthly_usd: number | null
  run_usd: number | null
}

export function parseRouting(value: unknown): RoutingSettings {
  const v = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>
  const usd = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null)
  return {
    mode: isMode(v.mode) ? v.mode : "smart",
    learning: v.learning !== false,
    cross_provider: v.cross_provider === true,
    stop_at_limit: v.stop_at_limit === true,
    daily_usd: usd(v.daily_usd),
    monthly_usd: usd(v.monthly_usd),
    run_usd: usd(v.run_usd),
  }
}

// Ajustes de la automatización: flows.settings.routing = { mode?, run_usd? }
// y flows.settings.model (modelo fijo).
export type FlowRouting = { mode: Mode | null; runUsd: number | null; fixedModel: string | null }

export function parseFlowRouting(settings: unknown): FlowRouting {
  const s = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>
  const r = (s.routing && typeof s.routing === "object" ? s.routing : {}) as Record<string, unknown>
  return {
    mode: isMode(r.mode) ? r.mode : null,
    runUsd: typeof r.run_usd === "number" && Number.isFinite(r.run_usd) && r.run_usd > 0 ? r.run_usd : null,
    fixedModel: typeof s.model === "string" && s.model ? s.model : null,
  }
}

// ---------------------------------------------------------------------------
// Presupuesto del espacio
// ---------------------------------------------------------------------------
type BudgetState = { forceEco: boolean; blocked: string | null }

async function budgetState(admin: SupabaseClient, workspaceId: string, settings: RoutingSettings): Promise<BudgetState> {
  if (!settings.daily_usd && !settings.monthly_usd) return { forceEco: false, blocked: null }
  const { data } = await admin.rpc("ai_spend", { p_workspace_id: workspaceId })
  const row = (data?.[0] ?? { day_usd: 0, month_usd: 0 }) as { day_usd: number | string; month_usd: number | string }
  const now = new Date().toISOString()
  const checks = [
    { limit: settings.monthly_usd, spent: Number(row.month_usd) || 0, period: `month:${now.slice(0, 7)}`, word: "del mes" },
    { limit: settings.daily_usd, spent: Number(row.day_usd) || 0, period: `day:${now.slice(0, 10)}`, word: "de hoy" },
  ]
  let over: (typeof checks)[number] | null = null
  for (const c of checks) {
    if (!c.limit) continue
    const ratio = c.spent / c.limit
    if (ratio >= 1) over ??= c
    if (ratio >= 0.8) {
      await budgetAlert(admin, workspaceId, c.period, ratio >= 1 ? 100 : 80, c.word, settings.stop_at_limit, c.limit)
        .catch(() => console.error("router: aviso de presupuesto"))
    }
  }
  if (!over) return { forceEco: false, blocked: null }
  if (settings.stop_at_limit) {
    return { forceEco: false, blocked: `Se ha llegado al presupuesto de IA ${over.word} (${formatUsd(over.limit!)}). Un administrador puede ampliarlo en Integraciones → LLMs.` }
  }
  return { forceEco: true, blocked: null }
}

// Un aviso por periodo y nivel, a owners y admins, sin datos de clientes.
async function budgetAlert(admin: SupabaseClient, workspaceId: string, period: string, level: 80 | 100, word: string, stop: boolean, limit: number) {
  const { data } = await admin
    .from("ai_budget_alerts")
    .upsert({ workspace_id: workspaceId, period, level }, { onConflict: "workspace_id,period,level", ignoreDuplicates: true })
    .select("level")
  if (!data?.length) return
  const { data: members } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
  const admins = (members ?? []).filter((x) => x.role === "owner" || x.role === "admin").map((x) => x.user_id)
  if (!admins.length) return
  await sendPush(admin, admins, {
    title: level === 100 ? "Presupuesto de IA agotado" : "Presupuesto de IA al 80 %",
    body: level === 100
      ? stop
        ? `Se ha llegado al presupuesto ${word} (${formatUsd(limit)}). Las tareas con IA se han parado.`
        : `Se ha llegado al presupuesto ${word} (${formatUsd(limit)}). A partir de ahora se usa el modo Ahorro.`
      : `Se ha gastado el 80 % del presupuesto de IA ${word} (${formatUsd(limit)}).`,
    url: `/w/${workspaceId}/integraciones?abrir=llm#llms`,
    tag: `budget-${period}-${level}`,
  })
}

// ---------------------------------------------------------------------------
// Elegir el modelo
// ---------------------------------------------------------------------------
export type Routed = {
  workspaceId: string
  task: Task
  plan: RoutePlan
  ai: Ai
  trial: boolean
  // Siguiente modelo del respaldo (con su clave), o null.
  next: (failedProvider: Provider, code: string) => Promise<Ai | null>
}

export type RouteError = { error: string; code: "no_ai" | "budget" }

type ConnRow = { provider: string; model: string; status: string; is_default: boolean; created_at: string }

async function connections(admin: SupabaseClient, workspaceId: string): Promise<Connection[]> {
  const { data } = await admin
    .from("ai_connections")
    .select("provider, model, status, is_default, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at")
  return ((data ?? []) as ConnRow[])
    .filter((r) => r.status === "active" && isProvider(r.provider))
    .map((r) => ({ provider: r.provider, model: r.model, isDefault: r.is_default }))
}

async function readSettings(admin: SupabaseClient, workspaceId: string): Promise<RoutingSettings> {
  const { data } = await admin.from("workspaces").select("ai_routing").eq("id", workspaceId).maybeSingle()
  return parseRouting(data?.ai_routing)
}

function keyring(admin: SupabaseClient, workspaceId: string) {
  const keys = new Map<string, Promise<string | null>>()
  return (provider: string) => {
    if (!keys.has(provider)) {
      keys.set(
        provider,
        (async () => {
          const { data } = await admin.rpc("ai_connection_secret", { p_workspace_id: workspaceId, p_provider: provider })
          const secret = data?.[0] as { api_key: string; status: string } | undefined
          return secret && secret.status === "active" ? secret.api_key : null
        })(),
      )
    }
    return keys.get(provider)!
  }
}

export async function routeAi(
  admin: SupabaseClient,
  workspaceId: string,
  task: Task,
  opts: {
    mode?: Mode | null
    fixedModel?: string | null
    complexity?: number
    needsTools?: boolean
    inputTokens?: number
    // Solo el chat y el onboarding (decisión del 1 nov).
    allowTrial?: boolean
  } = {},
): Promise<Routed | RouteError> {
  const conns = await connections(admin, workspaceId)
  if (!conns.length) {
    if (!opts.allowTrial) return { error: NO_AI_MESSAGE, code: "no_ai" }
    const trial = await resolveAiOrTrial(admin, workspaceId)
    if (!trial.ai) return { error: trial.message, code: "no_ai" }
    const plan: RoutePlan = {
      task,
      mode: "eco",
      fixed: true,
      primary: trial.ai.model,
      fallbacks: [],
      estimatedCostUsd: 0,
      reason: "Créditos de prueba de MarchaSolo.",
      scores: [],
    }
    return { workspaceId, task, plan, ai: trial.ai, trial: true, next: () => Promise.resolve(null) }
  }

  const settings = await readSettings(admin, workspaceId)
  const budget = await budgetState(admin, workspaceId, settings)
  if (budget.blocked) return { error: budget.blocked, code: "budget" }
  const mode: Mode = budget.forceEco ? "eco" : opts.mode ?? settings.mode
  const catalog = await loadCatalog(admin)
  const plan = rankModels({
    catalog,
    connections: conns,
    task,
    mode,
    fixedModel: opts.fixedModel,
    crossProvider: settings.cross_provider,
    complexity: opts.complexity,
    needsTools: opts.needsTools,
    inputTokens: opts.inputTokens,
  })
  if (!plan) return { error: NO_AI_MESSAGE, code: "no_ai" }
  if (budget.forceEco) plan.reason = `Presupuesto agotado: modo Ahorro. ${plan.reason}`

  const keyFor = keyring(admin, workspaceId)
  const providerOfModel = (model: string) => catalog.find((c) => c.model === model)?.provider as Provider | undefined
  const order = [plan.primary, ...plan.fallbacks]
  let index = -1
  const failed = new Set<string>()
  const advanceTo = async (): Promise<Ai | null> => {
    while (++index < order.length) {
      const model = order[index]
      const provider = providerOfModel(model)
      if (!provider || failed.has(provider)) continue
      const apiKey = await keyFor(provider)
      if (apiKey) return { provider, model, apiKey }
    }
    return null
  }
  const first = await advanceTo()
  if (!first) return { error: NO_AI_MESSAGE, code: "no_ai" }
  return {
    workspaceId,
    task,
    plan,
    ai: first,
    trial: false,
    // Saldo, límite o clave rechazada: todo ese proveedor queda fuera.
    // Caída puntual de un modelo: se puede probar otro del mismo proveedor.
    next: (failedProvider, code) => {
      if (code !== "provider") failed.add(failedProvider)
      return advanceTo()
    },
  }
}

export function isRouteError<T extends object>(x: T | RouteError): x is RouteError {
  return "error" in x && "code" in x
}

// Errores tras los que se prueba el siguiente modelo. No el tiempo de espera:
// repetir la llamada entera no cabe en el límite de las funciones.
const FALLBACK_CODES = new Set(["invalid_key", "limit", "provider"])

export async function callRouted<T>(
  admin: SupabaseClient,
  routed: Routed,
  meta: { userId: string | null; conversationId?: string | null; runId?: string | null },
  fn: (ai: Ai) => Promise<{ value: T; usage: Usage }>,
): Promise<{ value: T; ai: Ai; usage: Usage; costUsd: number }> {
  let ai = routed.ai
  let step: StepType = "primary"
  for (;;) {
    const started = Date.now()
    try {
      const res = await fn(ai)
      const cost = await recordUsage(admin, ai, res.usage, {
        workspaceId: routed.workspaceId,
        userId: meta.userId,
        conversationId: meta.conversationId,
        runId: meta.runId,
        task: routed.task,
        stepType: step,
        latencyMs: Date.now() - started,
      })
      return { value: res.value, ai, usage: res.usage, costUsd: cost }
    } catch (e) {
      await markInvalidIfNeeded(admin, routed.workspaceId, ai, e)
      if (!(e instanceof LlmError) || !FALLBACK_CODES.has(e.code)) throw e
      const next = await routed.next(ai.provider, e.code)
      if (!next) throw e
      console.log("router: respaldo", routed.task, ai.model, "→", next.model, e.code)
      ai = next
      step = "fallback"
    }
  }
}

// ---------------------------------------------------------------------------
// Ejecuciones del agente
// ---------------------------------------------------------------------------
// Lo que se guarda en flow_runs.routing (sin texto).
export type RunRouting = {
  task: Task
  mode: Mode | "fixed"
  primary: string
  fallbacks: string[]
  reason: string
  estimated_usd: number
  switches?: { from: string; to: string; code: string; at: string }[]
}

// Número de pasos del plan de una automatización (para la complejidad).
export function stepCount(definition: unknown): number {
  const steps = (definition as { steps?: unknown } | null)?.steps
  return Array.isArray(steps) ? steps.length : 0
}

export type PlannedRun = { model: string; routing: RunRouting; routingMode: Mode | "fixed"; budgetUsd: number }

export async function planRun(
  admin: SupabaseClient,
  workspaceId: string,
  opts: { task?: "agent" | "draft_reply"; flowId?: string | null; flowSettings?: unknown; steps?: number },
): Promise<PlannedRun | RouteError> {
  const flow = parseFlowRouting(opts.flowSettings)
  const task = opts.task ?? "agent"
  const routed = await routeAi(admin, workspaceId, task, {
    mode: flow.mode,
    fixedModel: flow.fixedModel,
    needsTools: true,
    complexity: task === "agent" ? (opts.steps ?? 0) >= 6 ? 4 : 3 : 2,
  })
  if (isRouteError(routed)) return routed

  const settings = await readSettings(admin, workspaceId)
  let budgetUsd = flow.runUsd ?? settings.run_usd
  if (!budgetUsd) {
    let recent: number[] = []
    if (opts.flowId) {
      const { data } = await admin
        .from("flow_runs")
        .select("cost_usd")
        .eq("flow_id", opts.flowId)
        .in("status", ["succeeded", "failed"])
        .gt("cost_usd", 0)
        .order("started_at", { ascending: false })
        .limit(20)
      recent = (data ?? []).map((r) => Number(r.cost_usd))
    }
    budgetUsd = autoRunBudget(routed.plan.mode, recent)
  }
  const routingMode = routed.plan.fixed ? "fixed" : routed.plan.mode
  return {
    model: routed.ai.model,
    routingMode,
    budgetUsd,
    routing: {
      task,
      mode: routingMode,
      primary: routed.ai.model,
      fallbacks: [routed.plan.primary, ...routed.plan.fallbacks].filter((x) => x !== routed.ai.model),
      reason: routed.plan.reason,
      estimated_usd: routed.plan.estimatedCostUsd,
    },
  }
}

// Clave para el modelo de una ejecución: el suyo si su proveedor sigue
// conectado; si no, el primero del respaldo que lo esté.
export async function aiForRun(
  admin: SupabaseClient,
  workspaceId: string,
  model: string | null,
  routing: RunRouting | null,
  skipProviders: Set<string> = new Set(),
): Promise<Ai | null> {
  const catalog = await loadCatalog(admin)
  const keyFor = keyring(admin, workspaceId)
  const conns = await connections(admin, workspaceId)
  const active = new Set(conns.map((c) => c.provider))
  const candidates = [model, ...(routing?.fallbacks ?? [])].filter((x): x is string => typeof x === "string" && x.length > 0)
  for (const m of candidates) {
    const provider = catalog.find((c) => c.model === m)?.provider
    if (!provider || !isProvider(provider) || !active.has(provider) || skipProviders.has(provider)) continue
    const apiKey = await keyFor(provider)
    if (apiKey) return { provider, model: m, apiKey }
  }
  // Ejecuciones de antes del router (sin respaldo guardado): la principal.
  if (!routing && !skipProviders.size) {
    const main = conns.find((c) => c.isDefault) ?? conns[0]
    if (main && isProvider(main.provider)) {
      const apiKey = await keyFor(main.provider)
      if (apiKey) return { provider: main.provider, model: main.model, apiKey }
    }
  }
  return null
}

export function parseRunRouting(value: unknown): RunRouting | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (typeof v.primary !== "string") return null
  return {
    task: v.task === "draft_reply" ? "draft_reply" : "agent",
    mode: v.mode === "fixed" || isMode(v.mode) ? v.mode : "smart",
    primary: v.primary,
    fallbacks: Array.isArray(v.fallbacks) ? v.fallbacks.filter((x): x is string => typeof x === "string").slice(0, 4) : [],
    reason: typeof v.reason === "string" ? v.reason : "",
    estimated_usd: Number(v.estimated_usd) || 0,
    switches: Array.isArray(v.switches) ? (v.switches as RunRouting["switches"])!.slice(-5) : [],
  }
}

export { formatUsd }
