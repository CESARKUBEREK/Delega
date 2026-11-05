import { asPlan, type FlowPlan } from "@/lib/plan"

export type OnboardingConnection = "email" | "messaging" | "spreadsheet" | "calendar" | "none"

// Devuelve todas las conexiones distintas que necesita el plan, en orden estable.
export function requiredConnections(plan: FlowPlan): OnboardingConnection[] {
  const kinds = new Set([...plan.connections.map((c) => c.kind), ...plan.steps.map((s) => s.connection)])
  const required: OnboardingConnection[] = []
  if (kinds.has("whatsapp") || kinds.has("telegram")) required.push("messaging")
  if (kinds.has("email")) required.push("email")
  if (kinds.has("spreadsheet") || kinds.has("drive") || kinds.has("documents")) required.push("spreadsheet")
  if (kinds.has("calendar")) required.push("calendar")
  return required
}

// Compatibilidad para pantallas que solo muestran la primera conexión.
export function primaryConnection(plan: FlowPlan): OnboardingConnection {
  return requiredConnections(plan)[0] ?? "none"
}

export const CONNECTION_LABEL: Record<OnboardingConnection, string> = {
  email: "Correo (IMAP)",
  messaging: "WhatsApp / Telegram",
  spreadsheet: "Google Drive / Planillas",
  calendar: "Google Calendar",
  none: "Ninguna por ahora",
}

// Sección de Integraciones donde está la tarjeta que hace falta.
export const CONNECTION_ANCHOR: Record<OnboardingConnection, string> = {
  email: "comunicaciones",
  messaging: "comunicaciones",
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

// Progreso del onboarding en este navegador (localStorage, 7 días), para no
// perder el plan al ir a la web del proveedor de IA, a Integraciones o a
// Google: crear la cuenta de IA y cargar saldo puede llevar más de una visita.
// Se borra al terminar o al caducar.
export type OnboardingSource = "assistant" | "trial" | "local"
export type OnboardingStep = "task" | "plan" | "ai" | "connect" | "done"

export type OnboardingSnapshot = {
  step: OnboardingStep
  task: string
  reply: string | null
  plan: FlowPlan | null
  // trial = el asistente real, con un plan de prueba de MarchaSolo.
  source: OnboardingSource | null
  conversationId: string | null
  trialRemaining: number | null
  // Borrador de automatización creado al aceptar el plan (si se pudo guardar).
  flowId: string | null
}

const STORAGE_PREFIX = "ms_onboarding:"
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
const STEPS: OnboardingStep[] = ["task", "plan", "ai", "connect", "done"]

export function loadOnboarding(workspaceId: string): OnboardingSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    // Lo de antes del 3 nov estaba en sessionStorage.
    const raw = storage()?.getItem(STORAGE_PREFIX + workspaceId) ?? window.sessionStorage.getItem(STORAGE_PREFIX + workspaceId)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<OnboardingSnapshot> & { savedAt?: number }
    if (typeof v.savedAt === "number" && Date.now() - v.savedAt > MAX_AGE_MS) {
      clearOnboarding(workspaceId)
      return null
    }
    // Lo guardado se valida: si algo no cuadra, se empieza de cero.
    const plan = v.plan ? asPlan(v.plan as never) : null
    // «supervised» era el paso 4 antiguo: ahora va dentro del plan.
    const rawStep = (v.step as string) === "supervised" ? "connect" : v.step
    let step: OnboardingStep = STEPS.includes(rawStep as OnboardingStep) ? (rawStep as OnboardingStep) : "task"
    if (step !== "task" && !plan) step = "task"
    if (step === "done") return null
    return {
      step,
      task: typeof v.task === "string" ? v.task.slice(0, 500) : "",
      reply: typeof v.reply === "string" ? v.reply : null,
      plan,
      source: v.source === "assistant" || v.source === "trial" || v.source === "local" ? v.source : null,
      conversationId: typeof v.conversationId === "string" ? v.conversationId : null,
      trialRemaining: typeof v.trialRemaining === "number" ? v.trialRemaining : null,
      flowId: typeof v.flowId === "string" ? v.flowId : null,
    }
  } catch {
    return null
  }
}

export function saveOnboarding(workspaceId: string, data: OnboardingSnapshot): void {
  if (typeof window === "undefined") return
  try {
    storage()?.setItem(STORAGE_PREFIX + workspaceId, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch {
    // Sin espacio o modo privado: el onboarding sigue funcionando sin guardar.
  }
}

export function clearOnboarding(workspaceId: string): void {
  if (typeof window === "undefined") return
  try {
    storage()?.removeItem(STORAGE_PREFIX + workspaceId)
    window.sessionStorage.removeItem(STORAGE_PREFIX + workspaceId)
  } catch {
    // Nada que hacer.
  }
}

// Paso 2: lo que MarchaSolo dirá antes de ejecutar este plan, sacado del plan
// real (pasos y conexiones), en primera persona.
export type SupervisedPreview = {
  will: string
  wont: string
  approvals: { id: string; title: string }[]
}

const lower = (t: string) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t)

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
}

export function supervisedPreview(plan: FlowPlan | null): SupervisedPreview {
  if (!plan) {
    return {
      will: "Antes de cada acción sensible te enseñaré exactamente qué voy a hacer.",
      wont: "No escribiré ni enviaré nada sin tu aprobación.",
      approvals: [],
    }
  }

  const approvalSteps = plan.steps.filter((s) => s.requires_approval)
  const freeSteps = plan.steps.filter((s) => !s.requires_approval)
  const kinds = new Set(
    [...plan.connections.map((c) => c.kind), ...plan.steps.map((s) => s.connection)].filter((k) => k && k !== "none"),
  )

  // Los títulos de los pasos con aprobación van aparte, en la lista: dentro
  // de la frase quedan forzados («permiso para escribir tras tu aprobación»).
  const first = freeSteps.length ? `Voy a ${joinList(freeSteps.slice(0, 2).map((s) => lower(s.title)))}.` : ""
  const then = approvalSteps.length
    ? `${first ? "Después te" : "Te"} enseñaré lo que propongo y esperaré tu permiso.`
    : first
      ? ""
      : `Voy a preparar «${plan.name}».`
  const will = [first, then].filter(Boolean).join(" ")

  const wont: string[] = []
  if (kinds.has("email")) wont.push("no enviaré ningún correo")
  if (kinds.has("spreadsheet") || kinds.has("drive") || kinds.has("documents")) wont.push("no escribiré en tus planillas ni documentos")
  if (kinds.has("calendar")) wont.push("no crearé ni cambiaré eventos")
  if (kinds.has("telegram") || kinds.has("whatsapp")) wont.push("no enviaré mensajes")
  if (kinds.has("crm") || kinds.has("hubspot") || kinds.has("contacts")) wont.push("no cambiaré tus contactos")
  const wontText = wont.length ? joinList(wont) : "no cambiaré ni enviaré nada"

  return {
    will,
    wont: `${wontText.charAt(0).toUpperCase()}${wontText.slice(1)} sin tu aprobación.`,
    approvals: approvalSteps.map((s) => ({ id: s.id, title: s.title })),
  }
}
