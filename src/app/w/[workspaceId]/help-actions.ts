"use server"

import { callEdgeFunction } from "@/lib/edge-functions"
import { asPlan } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { saveFlowPlan } from "./flow-editor-actions"
import { looksLikeSecret, SECRET_REPLY } from "@/lib/help"
import { UUID_RE } from "@/lib/workspace"

export type HelpTurn = { role: "user" | "assistant"; content: string }
export type StepChange = { step: number; description: string }
export type HelpAnswer =
  | { ok: true; reply: string; open: string | null; suggestions: string[]; trial: boolean; stepChanges: StepChange[]; flowId: string | null }
  | { ok: false; code: string; error: string }

// Pregunta al ayudante (acción «help» de la función assistant). La
// conversación no se guarda: la manda el panel en cada pregunta.
export async function askHelp(input: {
  workspaceId: string
  page: "integraciones" | "automatizaciones" | "onboarding" | "ejecucion"
  focus: string | null
  runId?: string | null
  history: HelpTurn[]
  message: string
}): Promise<HelpAnswer> {
  if (!UUID_RE.test(input.workspaceId)) return { ok: false, code: "bad_request", error: "Espacio no válido." }
  const message = input.message.trim().slice(0, 1000)
  if (!message) return { ok: false, code: "empty", error: "Escribe tu pregunta." }
  // Segunda barrera (la primera está en el panel): una clave no sale del servidor.
  if (looksLikeSecret(message)) return { ok: true, reply: SECRET_REPLY, open: input.focus, suggestions: [], trial: false, stepChanges: [], flowId: null }

  const result = await callEdgeFunction<{
    reply: string
    open: string | null
    suggestions: string[]
    trial?: boolean
    step_changes?: StepChange[]
    flow_id?: string | null
  }>(
    "assistant",
    {
      action: "help",
      workspace_id: input.workspaceId,
      page: input.page,
      focus: input.focus,
      run_id: input.runId && UUID_RE.test(input.runId) ? input.runId : null,
      history: input.history.slice(-8),
      message,
    },
    60_000,
  )
  if (result.error) return { ok: false, code: result.error.code, error: result.error.message }
  return {
    ok: true,
    reply: result.data.reply,
    open: result.data.open,
    suggestions: result.data.suggestions ?? [],
    trial: Boolean(result.data.trial),
    stepChanges: result.data.step_changes ?? [],
    flowId: typeof result.data.flow_id === "string" && UUID_RE.test(result.data.flow_id) ? result.data.flow_id : null,
  }
}

// Aplica los cambios de instrucciones que propuso el ayudante a una
// automatización guardada: solo descripciones de pasos que existen. Se guarda
// con saveFlowPlan, que vuelve a normalizar el plan e impone las aprobaciones
// (y la base de datos, otra vez). Los permisos son los del editor (RLS).
export async function applyStepChanges(input: {
  workspaceId: string
  flowId: string
  changes: StepChange[]
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(input.workspaceId) || !UUID_RE.test(input.flowId)) return { ok: false, error: "Datos no válidos." }
  const supabase = await createClient()
  const { data: flow } = await supabase
    .from("flows")
    .select("id, definition, settings")
    .eq("id", input.flowId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle()
  const plan = flow ? asPlan(flow.definition) : null
  if (!flow || !plan) return { ok: false, error: "No se encontró la automatización." }
  const changes = (Array.isArray(input.changes) ? input.changes : []).filter(
    (c) => Number.isInteger(c?.step) && c.step >= 1 && c.step <= plan.steps.length && typeof c.description === "string" && c.description.trim(),
  )
  if (!changes.length) return { ok: false, error: "No hay cambios que aplicar." }
  const steps = plan.steps.map((st, i) => {
    const change = changes.find((c) => c.step === i + 1)
    return change ? { ...st, description: change.description.trim().slice(0, 600) } : st
  })
  const settings = (flow.settings ?? {}) as { file_ids?: unknown }
  const fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter((id): id is string => typeof id === "string") : []
  const saved = await saveFlowPlan({ workspaceId: input.workspaceId, flowId: flow.id, plan: { ...plan, steps }, fileIds })
  return saved.ok ? { ok: true } : { ok: false, error: saved.error }
}
