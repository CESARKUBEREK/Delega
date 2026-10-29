// Reglas del editor visual de flujos. Las usan la pantalla (para mostrar qué
// se puede elegir) y el servidor (para guardar): el servidor siempre vuelve a
// normalizar lo que llega del navegador.
//
// Mismas reglas que supabase/functions/assistant/plan-schema.ts (sanitizePlan):
// límites de tamaño y aprobación obligatoria en todo paso que escriba o envíe
// a otras personas. Avisar al propio usuario (notify sin conexión) no la pide.
// Además, la base de datos lo vuelve a imponer (trigger flows_enforce_approval).
//
// Sin dependencias de Next ni de Supabase: se prueba con `node --test`.

import type { FlowPlan, PlanStep, TriggerType } from "./plan"

export const MAX_STEPS = 20
export const MAX_TITLE = 120
export const MAX_DESCRIPTION = 600
export const MAX_NAME = 120
export const MAX_SUMMARY = 600
export const MAX_FILES = 5

export const STEP_KINDS = ["read", "compare", "transform", "generate", "condition", "write", "notify"] as const
export type StepKind = (typeof STEP_KINDS)[number]

export const CONNECTION_KINDS = ["spreadsheet", "documents", "drive", "email", "telegram", "whatsapp", "calendar", "crm", "properties", "accounting", "social"] as const
export type ConnectionKind = (typeof CONNECTION_KINDS)[number]

export const TRIGGERS: TriggerType[] = ["manual", "schedule", "email_message", "whatsapp_message", "telegram_message"]

// Qué hace cada tipo de paso, en palabras del usuario.
export const KIND_INFO: Record<StepKind, { label: string; hint: string }> = {
  read: { label: "Consultar", hint: "Leer una planilla, un documento, la agenda, el correo o el CRM." },
  compare: { label: "Buscar o comparar", hint: "Encontrar algo concreto: vencimientos, duplicados, diferencias." },
  transform: { label: "Preparar datos", hint: "Ordenar, calcular o sacar los datos de un texto." },
  generate: { label: "Redactar", hint: "Escribir un resumen, una respuesta o un informe." },
  condition: { label: "Solo si…", hint: "Seguir solo si se cumple algo (p. ej. «si no hay nada, terminar»)." },
  write: { label: "Escribir o crear", hint: "Añadir filas, crear un documento o un evento, actualizar el CRM o publicar en redes. Necesita tu aprobación." },
  notify: { label: "Avisar o enviar", hint: "Avisarte a ti (sin aprobación) o escribir a otras personas (con aprobación)." },
}

// Aplicaciones que tiene sentido elegir en cada tipo de paso. "none" = sin aplicación.
export const KIND_CONNECTIONS: Record<StepKind, ("none" | ConnectionKind)[]> = {
  read: ["spreadsheet", "documents", "drive", "email", "whatsapp", "telegram", "calendar", "crm", "properties", "accounting"],
  compare: ["none", "spreadsheet", "documents", "drive", "email", "calendar", "crm", "properties", "accounting"],
  transform: ["none", "spreadsheet", "documents", "email", "whatsapp", "telegram"],
  generate: ["none", "documents"],
  condition: ["none"],
  write: ["spreadsheet", "documents", "drive", "calendar", "crm", "properties", "social"],
  notify: ["none", "email", "whatsapp", "telegram"],
}

// Qué integración del espacio necesita cada aplicación (para ocultar las que no están conectadas).
export const CONNECTION_PROVIDER: Record<ConnectionKind, string> = {
  spreadsheet: "google",
  documents: "google",
  drive: "google",
  email: "imap",
  telegram: "telegram",
  whatsapp: "whatsapp",
  calendar: "calendar",
  crm: "hubspot",
  properties: "tokko",
  accounting: "xubio",
  social: "buffer",
}

export const CONNECTION_NAME: Record<"none" | ConnectionKind, string> = {
  none: "Sin aplicación",
  spreadsheet: "Planilla (Sheets o Excel)",
  documents: "Documento de Google Docs",
  drive: "Archivos o carpetas de Drive",
  email: "Correo",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  calendar: "Google Calendar",
  crm: "HubSpot",
  properties: "Tokko Broker",
  accounting: "Xubio (solo lectura)",
  social: "Redes sociales (Buffer)",
}

// En «Avisar o enviar», qué significa cada opción.
export const NOTIFY_TARGET: Record<"none" | "email" | "whatsapp" | "telegram", string> = {
  none: "A mí (móvil, correo o Telegram, sin aprobación)",
  email: "Por correo a otra persona (con aprobación)",
  whatsapp: "Por WhatsApp a quien escribió (con aprobación)",
  telegram: "Por Telegram a quien escribió al bot (con aprobación)",
}

// Escribir, o enviar a otras personas, siempre necesita aprobación.
export function needsApproval(kind: string, connection: string): boolean {
  return kind === "write" || (kind === "notify" && connection !== "none")
}

const cut = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+$/g, "").slice(0, n) : "")
const isKind = (v: unknown): v is StepKind => typeof v === "string" && (STEP_KINDS as readonly string[]).includes(v)

export type EditorStep = { kind: string; title: string; description: string; connection: string }
export type EditorPlan = {
  name: string
  summary: string
  trigger: { type: string; description: string }
  steps: EditorStep[]
}

export type Normalized = { ok: true; plan: FlowPlan } | { ok: false; error: string }

// Convierte lo que llega del editor en un plan válido (versión 1). Rechaza lo
// que no se puede arreglar (sin nombre, sin pasos, pasos vacíos); el resto lo
// corrige (aplicaciones no válidas para el tipo, límites, aprobación).
export function normalizePlan(input: unknown, previous?: FlowPlan | null): Normalized {
  const o = input && typeof input === "object" ? (input as Partial<EditorPlan>) : {}
  const name = cut(o.name, MAX_NAME).trim()
  if (!name) return { ok: false, error: "Ponle un nombre a la automatización." }
  const rawSteps = Array.isArray(o.steps) ? o.steps : []
  if (rawSteps.length === 0) return { ok: false, error: "Añade al menos un paso." }
  if (rawSteps.length > MAX_STEPS) return { ok: false, error: `Como mucho ${MAX_STEPS} pasos.` }

  const steps: PlanStep[] = []
  for (const [i, raw] of rawSteps.entries()) {
    const s = raw && typeof raw === "object" ? (raw as Partial<EditorStep>) : {}
    const kind: StepKind = isKind(s.kind) ? s.kind : "transform"
    const allowed = KIND_CONNECTIONS[kind] as string[]
    const connection = typeof s.connection === "string" && allowed.includes(s.connection) ? s.connection : allowed[0]
    const title = cut(s.title, MAX_TITLE).trim()
    const description = cut(s.description, MAX_DESCRIPTION).trim()
    if (!title && !description) return { ok: false, error: `El paso ${i + 1} está vacío: escribe qué tiene que hacer.` }
    steps.push({
      id: `s${i + 1}`,
      kind,
      title: title || description.slice(0, 60),
      description,
      connection,
      requires_approval: needsApproval(kind, connection),
    })
  }

  const triggerType: TriggerType = TRIGGERS.includes(o.trigger?.type as TriggerType) ? (o.trigger!.type as TriggerType) : "manual"

  // Las conexiones salen de los pasos; se conserva el «para qué» que ya hubiera.
  const used = [...new Set(steps.map((s) => s.connection).filter((c) => c !== "none"))]
  const connections = used.map((kind) => ({
    kind,
    purpose:
      previous?.connections.find((c) => c.kind === kind)?.purpose ||
      steps.filter((s) => s.connection === kind).map((s) => s.title).join("; ").slice(0, 200),
  }))

  return {
    ok: true,
    plan: {
      version: 1,
      name,
      summary: cut(o.summary, MAX_SUMMARY).trim(),
      trigger: { type: triggerType, description: cut(o.trigger?.description, 200).trim() },
      connections,
      steps,
      // Lo pendiente que dejó el asistente desaparece al editar a mano.
      open_questions: [],
    },
  }
}

export type CheckContext = {
  connected: Set<string>
  fileKinds: string[]
  contacts: number
}

// Comprobaciones antes de guardar o activar. No bloquean: avisan.
export function planChecks(plan: EditorPlan, ctx: CheckContext): string[] {
  const out: string[] = []
  const steps = plan.steps
  const missing = new Set<string>()
  for (const s of steps) {
    if (s.connection !== "none" && (CONNECTION_KINDS as readonly string[]).includes(s.connection)) {
      const provider = CONNECTION_PROVIDER[s.connection as ConnectionKind]
      if (!ctx.connected.has(provider)) missing.add(CONNECTION_NAME[s.connection as ConnectionKind])
    }
  }
  for (const m of missing) out.push(`${m} no está conectado: conéctalo en Integraciones o cambia ese paso.`)

  const needs = (k: string) => steps.some((s) => s.connection === k)
  if (needs("spreadsheet") && !ctx.fileKinds.some((k) => k === "planilla" || k === "excel")) {
    out.push("Hay pasos con una planilla pero no has elegido ninguna en «Archivos que usa».")
  }
  if (needs("documents") && steps.some((s) => s.connection === "documents" && s.kind !== "write") && !ctx.fileKinds.includes("documento")) {
    out.push("Hay pasos que leen un documento pero no has elegido ninguno en «Archivos que usa».")
  }
  if (needs("drive") && ctx.fileKinds.length === 0) out.push("Hay pasos con Drive pero no has elegido archivos ni carpetas.")
  if (steps.some((s) => s.kind === "notify" && s.connection === "email") && plan.trigger.type !== "email_message" && ctx.contacts === 0) {
    out.push("Para escribir por correo a otras personas hace falta tenerlas en Contactos autorizados (Configuración).")
  }
  if (steps.some((s) => s.kind === "notify" && s.connection === "telegram") && plan.trigger.type !== "telegram_message") {
    out.push("Enviar por Telegram solo funciona para contestar a quien escribió al bot: usa el inicio «Al recibir un mensaje en Telegram».")
  }
  if (steps.some((s) => s.kind === "notify" && s.connection === "whatsapp") && plan.trigger.type !== "whatsapp_message") {
    out.push("Por WhatsApp solo se puede contestar a quien escribió en las últimas 24 h: lo normal es empezar con «Al recibir un WhatsApp».")
  }
  if (plan.trigger.type === "schedule" && !steps.some((s) => s.kind === "notify" || s.kind === "write")) {
    out.push("Se ejecuta sola, pero ningún paso te avisa ni guarda nada: no verás el resultado salvo en Ejecuciones.")
  }
  return out
}
