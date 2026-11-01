import { asPlan, type FlowPlan } from "@/lib/plan"

export type OnboardingConnection = "email" | "spreadsheet" | "calendar" | "none"

// Detecta la conexión principal que necesita un plan del onboarding.
// Vive fuera de actions.ts porque un archivo "use server" solo puede exportar
// funciones async, y esta se usa también en el cliente.
export function primaryConnection(plan: FlowPlan): OnboardingConnection {
  const kinds = new Set([...plan.connections.map((c) => c.kind), ...plan.steps.map((s) => s.connection)])
  if (kinds.has("email")) return "email"
  if (kinds.has("spreadsheet") || kinds.has("drive") || kinds.has("documents")) return "spreadsheet"
  if (kinds.has("calendar")) return "calendar"
  return "none"
}

export const CONNECTION_LABEL: Record<OnboardingConnection, string> = {
  email: "Correo (IMAP)",
  spreadsheet: "Google Drive / Planillas",
  calendar: "Google Calendar",
  none: "Ninguna por ahora",
}

// Sección de Integraciones donde está la tarjeta que hace falta.
export const CONNECTION_ANCHOR: Record<OnboardingConnection, string> = {
  email: "comunicaciones",
  spreadsheet: "drives",
  calendar: "calendar",
  none: "llms",
}

// Adónde lleva «Abrir el chat» al terminar: a la conversación del plan, si la
// creó el asistente; si no (plan sin IA), al chat con la tarea ya escrita.
export function chatHref(base: string, conversationId: string | null, task: string): string {
  if (conversationId) return `${base}/asistente?c=${conversationId}`
  const q = task.trim()
  return q ? `${base}/asistente?q=${encodeURIComponent(q)}` : `${base}/asistente`
}

// Progreso del onboarding en esta pestaña (sessionStorage), para no perder el
// plan al ir a Integraciones (o a Google) y volver. Se borra al terminar; al
// cerrar la pestaña se pierde a propósito.
export type OnboardingStep = "task" | "plan" | "connect" | "supervised" | "done"

export type OnboardingSnapshot = {
  step: OnboardingStep
  task: string
  reply: string | null
  plan: FlowPlan | null
  source: "assistant" | "local" | null
  conversationId: string | null
  supervisedAccepted: boolean
}

const STORAGE_PREFIX = "ms_onboarding:"
const STEPS: OnboardingStep[] = ["task", "plan", "connect", "supervised", "done"]

export function loadOnboarding(workspaceId: string): OnboardingSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + workspaceId)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<OnboardingSnapshot>
    // Lo guardado se valida: si algo no cuadra, se empieza de cero.
    const plan = v.plan ? asPlan(v.plan as never) : null
    let step: OnboardingStep = STEPS.includes(v.step as OnboardingStep) ? (v.step as OnboardingStep) : "task"
    if (step !== "task" && !plan) step = "task"
    if (step === "done") return null
    return {
      step,
      task: typeof v.task === "string" ? v.task.slice(0, 500) : "",
      reply: typeof v.reply === "string" ? v.reply : null,
      plan,
      source: v.source === "assistant" || v.source === "local" ? v.source : null,
      conversationId: typeof v.conversationId === "string" ? v.conversationId : null,
      supervisedAccepted: v.supervisedAccepted === true,
    }
  } catch {
    return null
  }
}

export function saveOnboarding(workspaceId: string, data: OnboardingSnapshot): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + workspaceId, JSON.stringify(data))
  } catch {
    // Sin espacio o modo privado: el onboarding sigue funcionando sin guardar.
  }
}

export function clearOnboarding(workspaceId: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + workspaceId)
  } catch {
    // Nada que hacer.
  }
}
