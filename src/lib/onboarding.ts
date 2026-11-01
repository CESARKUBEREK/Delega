import type { FlowPlan } from "@/lib/plan"

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
