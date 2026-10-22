import type { Json } from "@/lib/supabase/database.types"

// Formato interno de un flujo (versión 1). Lo genera la Edge Function
// "assistant" (supabase/functions/assistant/plan-schema.ts) y se guarda tal
// cual en messages.plan y flows.definition.

export type PlanStep = {
  id: string
  kind: string
  title: string
  description: string
  connection: string
  requires_approval: boolean
}

export type FlowPlan = {
  version: 1
  name: string
  summary: string
  trigger: { type: "manual" | "schedule" | "telegram_message"; description: string }
  connections: { kind: string; purpose: string }[]
  steps: PlanStep[]
  open_questions: string[]
}

const str = (v: unknown) => (typeof v === "string" ? v : "")
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

// Lee un plan guardado en la base de datos sin fiarse de su forma.
export function asPlan(value: Json | null | undefined): FlowPlan | null {
  const p = obj(value)
  if (!Array.isArray(p.steps)) return null
  const trigger = obj(p.trigger)
  return {
    version: 1,
    name: str(p.name) || "Flujo sin nombre",
    summary: str(p.summary),
    trigger: {
      type: trigger.type === "schedule" || trigger.type === "telegram_message" ? trigger.type : "manual",
      description: str(trigger.description),
    },
    connections: arr(p.connections).map((c) => ({ kind: str(obj(c).kind), purpose: str(obj(c).purpose) })),
    steps: arr(p.steps).map((s, i) => {
      const o = obj(s)
      return {
        id: str(o.id) || `s${i + 1}`,
        kind: str(o.kind),
        title: str(o.title),
        description: str(o.description),
        connection: str(o.connection),
        requires_approval: o.requires_approval === true,
      }
    }),
    open_questions: arr(p.open_questions).map(str).filter(Boolean),
  }
}

export const STEP_LABEL: Record<string, string> = {
  read: "Leer",
  transform: "Preparar",
  compare: "Comparar",
  generate: "Redactar",
  write: "Escribir",
  notify: "Avisar",
  condition: "Condición",
}

export const CONNECTION_LABEL: Record<string, string> = {
  spreadsheet: "Planilla",
  email: "Correo",
  calendar: "Calendario",
  database: "Base de datos",
  documents: "Documento",
  telegram: "Telegram",
  none: "",
}

// Conexiones que ya funcionan en esta versión.
export const AVAILABLE_CONNECTIONS = new Set(["spreadsheet", "documents", "email", "telegram"])

export const TRIGGER_LABEL: Record<string, string> = {
  manual: "Manual",
  schedule: "Programado (aún no automático)",
  telegram_message: "Al recibir un mensaje en Telegram",
}

export const FLOW_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "En pausa",
}

export const OPENAI_MODELS = [
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", hint: "Equilibrado. Recomendado." },
  { id: "gpt-6-astra", label: "GPT-6 Astra", hint: "El más capaz, más caro." },
  { id: "gpt-6-luna", label: "GPT-6 Luna", hint: "El más económico." },
] as const

export const RUN_STATUS_LABEL: Record<string, string> = {
  running: "En curso",
  awaiting_approval: "Esperando tu aprobación",
  succeeded: "Terminada",
  failed: "Con error",
  cancelled: "Cancelada",
}
