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

// Ayudante por voz (fase 7-4). ¿Está activado en el espacio y hay clave de xAI?
export async function helpVoiceAvailable(workspaceId: string): Promise<{ enabled: boolean; xai: boolean; isAdmin: boolean }> {
  if (!UUID_RE.test(workspaceId)) return { enabled: false, xai: false, isAdmin: false }
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  const [{ data: ws }, { data: ai }, { data: me }] = await Promise.all([
    supabase.from("workspaces").select("help_voice_enabled").eq("id", workspaceId).maybeSingle(),
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId).eq("provider", "xai").maybeSingle(),
    userId
      ? supabase.from("memberships").select("role, status").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const isAdmin = me?.status === "active" && (me.role === "owner" || me.role === "admin")
  return { enabled: Boolean(ws?.help_voice_enabled), xai: ai?.status === "active", isAdmin }
}

// Token temporal y configuración para hablar con el ayudante.
export async function startHelpVoice(input: {
  workspaceId: string
  page: string
}): Promise<{ ok: true; token: string; model: string; max_minutes: number; session: Record<string, unknown> } | { ok: false; error: string }> {
  if (!UUID_RE.test(input.workspaceId)) return { ok: false, error: "Espacio no válido." }
  const result = await callEdgeFunction<{ token: string; model: string; max_minutes: number; session: Record<string, unknown> }>(
    "assistant",
    { action: "help_voice", workspace_id: input.workspaceId, page: String(input.page).slice(0, 30) },
    30_000,
  )
  if (result.error) return { ok: false, error: result.error.message }
  return { ok: true, ...result.data }
}

// Activar o desactivar la conversación por voz (solo administradores).
export async function setHelpVoice(workspaceId: string, enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(workspaceId)) return { ok: false, error: "Espacio no válido." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("workspace_set_help_voice", { p_workspace_id: workspaceId, p_enabled: enabled })
  if (error) return { ok: false, error: "No se pudo guardar." }
  if (!data) return { ok: false, error: "Solo un administrador puede cambiarlo." }
  return { ok: true }
}
