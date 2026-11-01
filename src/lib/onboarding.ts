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
