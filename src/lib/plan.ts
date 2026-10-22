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
  drive: "Drive",
  crm: "HubSpot",
  none: "",
}

// Conexiones que ya funcionan en esta versión.
export const AVAILABLE_CONNECTIONS = new Set(["spreadsheet", "documents", "drive", "email", "telegram", "calendar", "crm"])

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
  schedule: "Programado (aún no automático)",
  telegram_message: "Al recibir un mensaje en Telegram",
}

export const FLOW_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  paused: "En pausa",
}

// Proveedores de IA (BYOK). El servidor tiene la misma lista en _shared/llm.ts.
export const LLM_PROVIDER_IDS = ["openai", "anthropic", "deepseek", "kimi"] as const
export type LlmProvider = (typeof LLM_PROVIDER_IDS)[number]

export type LlmModel = { id: string; label: string; hint: string }
export type LlmProviderInfo = {
  label: string
  description: string
  keyPrefix: string
  placeholder: string
  keysUrl: string
  keysSteps: string[]
  privacy: string
  models: LlmModel[]
}

export const LLM_PROVIDERS: Record<LlmProvider, LlmProviderInfo> = {
  openai: {
    label: "OpenAI",
    description: "Modelos GPT con tu propia clave.",
    keyPrefix: "sk-",
    placeholder: "sk-…",
    keysUrl: "https://platform.openai.com/api-keys",
    keysSteps: [
      "Entra en platform.openai.com con tu cuenta y abre «API keys».",
      "Crea una clave nueva para Orkesta y cópiala. Tu cuenta necesita saldo o un método de pago.",
    ],
    privacy: "Orkesta pide a OpenAI que no conserve las conversaciones (store: false).",
    models: [
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", hint: "Equilibrado. Recomendado." },
      { id: "gpt-6-astra", label: "GPT-6 Astra", hint: "El más capaz, más caro." },
      { id: "gpt-6-luna", label: "GPT-6 Luna", hint: "El más económico." },
    ],
  },
  anthropic: {
    label: "Anthropic",
    description: "Modelos Claude con tu propia clave.",
    keyPrefix: "sk-ant-",
    placeholder: "sk-ant-…",
    keysUrl: "https://platform.claude.com/settings/keys",
    keysSteps: [
      "Entra en platform.claude.com con tu cuenta y abre «API keys».",
      "Crea una clave para Orkesta y cópiala. Tu cuenta necesita créditos o un método de pago.",
    ],
    privacy: "Los textos que procesa Orkesta se envían a Anthropic; consulta su política de datos de la API.",
    models: [
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", hint: "Equilibrado. Recomendado." },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", hint: "El más capaz, más caro." },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", hint: "El más rápido y económico." },
    ],
  },
  deepseek: {
    label: "DeepSeek",
    description: "Modelos DeepSeek con tu propia clave.",
    keyPrefix: "sk-",
    placeholder: "sk-…",
    keysUrl: "https://platform.deepseek.com/api_keys",
    keysSteps: [
      "Entra en platform.deepseek.com con tu cuenta y abre «API keys».",
      "Crea una clave para Orkesta y cópiala. La cuenta funciona con saldo prepago: recárgala antes.",
    ],
    privacy: "Los textos que procesa Orkesta se envían a los servidores de DeepSeek; revisa su política de datos antes de usarlo con información de clientes.",
    models: [
      { id: "deepseek-flash", label: "DeepSeek Flash", hint: "Rápido y muy económico. Recomendado." },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", hint: "Más capaz, unas tres veces más caro." },
    ],
  },
  kimi: {
    label: "Kimi",
    description: "Modelos Kimi de Moonshot AI con tu propia clave.",
    keyPrefix: "sk-",
    placeholder: "sk-…",
    keysUrl: "https://platform.kimi.ai",
    keysSteps: [
      "Entra en platform.kimi.ai (la plataforma internacional) y abre «API Keys».",
      "Crea una clave para Orkesta y cópiala. Las claves de la plataforma china (moonshot.cn) no sirven aquí.",
    ],
    privacy: "Los textos que procesa Orkesta se envían a los servidores de Moonshot AI; revisa su política de datos antes de usarlo con información de clientes.",
    models: [
      { id: "kimi-k3", label: "Kimi K3", hint: "El más capaz. Recomendado." },
      { id: "kimi-k2.6", label: "Kimi K2.6", hint: "Generación anterior." },
    ],
  },
}

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && (LLM_PROVIDER_IDS as readonly string[]).includes(value)
}

// Nombre legible de un modelo de cualquier proveedor.
export function modelLabel(model: string | null | undefined): string {
  if (!model) return ""
  for (const p of LLM_PROVIDER_IDS) {
    const m = LLM_PROVIDERS[p].models.find((x) => x.id === model)
    if (m) return m.label
  }
  return model
}

export function providerLabel(provider: string | null | undefined): string {
  return isLlmProvider(provider) ? LLM_PROVIDERS[provider].label : (provider ?? "")
}

export const RUN_STATUS_LABEL: Record<string, string> = {
  running: "En curso",
  awaiting_approval: "Esperando tu aprobación",
  succeeded: "Terminada",
  failed: "Con error",
  cancelled: "Cancelada",
}
