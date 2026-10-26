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

export type TriggerType = "manual" | "schedule" | "telegram_message" | "email_message" | "whatsapp_message"
export const AUTO_TRIGGERS = new Set<TriggerType>(["telegram_message", "email_message", "whatsapp_message", "schedule"])

export type FlowPlan = {
  version: 1
  name: string
  summary: string
  trigger: { type: TriggerType; description: string }
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
      type:
        trigger.type === "schedule" || trigger.type === "telegram_message" || trigger.type === "email_message" || trigger.type === "whatsapp_message"
          ? trigger.type
          : "manual",
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
  whatsapp: "WhatsApp",
  drive: "Drive",
  crm: "HubSpot",
  properties: "Tokko",
  accounting: "Xubio",
  none: "",
}

// Conexiones que ya funcionan en esta versión.
export const AVAILABLE_CONNECTIONS = new Set(["spreadsheet", "documents", "drive", "email", "telegram", "whatsapp", "calendar", "crm", "properties", "accounting"])

// Tipo legible de un archivo elegido en Drive.
export function fileKindLabel(mime: string | null): string {
  switch (mime) {
    case "application/vnd.google-apps.spreadsheet":
      return "Planilla"
    case "application/vnd.google-apps.document":
      return "Documento"
    case "application/vnd.google-apps.folder":
      return "Carpeta"
    case "application/vnd.google-apps.presentation":
      return "Presentación"
    case "application/pdf":
      return "PDF"
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/msword":
      return "Word"
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.ms-excel":
      return "Excel"
    default:
      return "Archivo"
  }
}

export const TRIGGER_LABEL: Record<string, string> = {
  manual: "Manual",
  schedule: "Programado",
  telegram_message: "Al recibir un mensaje en Telegram",
  whatsapp_message: "Al recibir un WhatsApp",
  email_message: "Al llegar un correo",
}

export const FLOW_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "En pausa",
}

export type AiProvider = "openai" | "anthropic" | "deepseek"
export type AiModel = { id: string; label: string; hint: string }

// Proveedores de IA (BYOK) y sus modelos. Debe coincidir con
// supabase/functions/_shared/llm.ts. El primero de cada lista es el recomendado.
export const AI_PROVIDERS: { id: AiProvider; label: string; keyPrefix: string; console: string; models: AiModel[] }[] = [
  {
    id: "openai",
    label: "OpenAI",
    keyPrefix: "sk-",
    console: "platform.openai.com → API keys",
    models: [
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", hint: "Equilibrado. Recomendado." },
      { id: "gpt-6-astra", label: "GPT-6 Astra", hint: "El más capaz, más caro." },
      { id: "gpt-6-luna", label: "GPT-6 Luna", hint: "El más económico." },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    keyPrefix: "sk-ant-",
    console: "platform.claude.com → API Keys",
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", hint: "Rápido y capaz. Recomendado." },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", hint: "El más capaz para tareas largas." },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", hint: "El más rápido y económico." },
      { id: "claude-fable-5-1", label: "Claude Fable 5.1", hint: "Para el razonamiento más exigente, más caro." },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    keyPrefix: "sk-",
    console: "platform.deepseek.com → API keys",
    models: [
      { id: "deepseek-flash", label: "DeepSeek V4.1 Flash", hint: "Rápido y muy económico. Recomendado." },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", hint: "Más capaz." },
    ],
  },
]

export const AI_MODELS: AiModel[] = AI_PROVIDERS.flatMap((p) => p.models)

export function aiProviderOf(model: string | null | undefined): AiProvider | null {
  return AI_PROVIDERS.find((p) => p.models.some((m) => m.id === model))?.id ?? null
}

export function modelLabel(model: string | null | undefined): string {
  return AI_MODELS.find((m) => m.id === model)?.label ?? model ?? ""
}

export const RUN_STATUS_LABEL: Record<string, string> = {
  running: "En curso",
  awaiting_approval: "Esperando tu aprobación",
  succeeded: "Terminada",
  failed: "Con error",
  cancelled: "Cancelada",
}

export type FlowSchedule = { frequency: "daily" | "weekdays" | "weekly" | "monthly"; time: string; weekday: number; day_of_month: number }

// Programación que propuso el asistente (plan.trigger.schedule), validada.
export function scheduleOf(value: Json | null | undefined): FlowSchedule | null {
  const t = obj(obj(value).trigger)
  if (t.type !== "schedule") return null
  const o = obj(t.schedule)
  if (!["daily", "weekdays", "weekly", "monthly"].includes(String(o.frequency))) return null
  if (typeof o.time !== "string" || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(o.time)) return null
  const weekday = typeof o.weekday === "number" && Number.isInteger(o.weekday) && o.weekday >= 1 && o.weekday <= 7 ? o.weekday : 1
  const day = typeof o.day_of_month === "number" && Number.isInteger(o.day_of_month) && o.day_of_month >= 0 && o.day_of_month <= 28 ? o.day_of_month : 1
  return { frequency: o.frequency as FlowSchedule["frequency"], time: o.time, weekday, day_of_month: day }
}
