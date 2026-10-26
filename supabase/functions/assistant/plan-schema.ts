// Formato interno de un flujo de Delega (versión 1). Lo comparten el
// asistente (que lo genera) y el editor (que lo muestra y, más adelante,
// lo editará y ejecutará). Es JSON Schema estricto para Structured Outputs.

const CONNECTION_KINDS = ["spreadsheet", "documents", "drive", "email", "telegram", "whatsapp", "calendar", "crm", "properties", "accounting", "database"]
const STEP_KINDS = ["read", "transform", "compare", "generate", "write", "notify", "condition"]

const planObject = {
  type: "object",
  additionalProperties: false,
  required: ["name", "summary", "trigger", "connections", "steps", "open_questions"],
  properties: {
    name: { type: "string", description: "Nombre corto del flujo, en español." },
    summary: { type: "string", description: "Qué hace el flujo, en una o dos frases." },
    trigger: {
      type: "object",
      additionalProperties: false,
      required: ["type", "description", "schedule"],
      properties: {
        type: { type: "string", enum: ["manual", "schedule", "telegram_message", "email_message", "whatsapp_message"] },
        description: { type: "string", description: "Cuándo se ejecuta, en palabras (p. ej. 'el día 1 de cada mes' o 'cuando llegue un mensaje de Telegram')." },
        schedule: {
          description: "Solo si type es 'schedule': cuándo, para rellenar la programación. Si no, null.",
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: ["frequency", "time", "weekday", "day_of_month"],
              properties: {
                frequency: { type: "string", enum: ["daily", "weekdays", "weekly", "monthly"] },
                time: { type: "string", description: "Hora local HH:MM (24 h)." },
                weekday: { type: "integer", description: "Solo semanal: 1 = lunes … 7 = domingo; si no, 1." },
                day_of_month: { type: "integer", description: "Solo mensual: 1-28, o 0 = último día; si no, 1." },
              },
            },
          ],
        },
      },
    },
    connections: {
      type: "array",
      description: "Aplicaciones o datos que el flujo necesita.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "purpose"],
        properties: {
          kind: { type: "string", enum: CONNECTION_KINDS },
          purpose: { type: "string" },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "kind", "title", "description", "connection", "requires_approval"],
        properties: {
          id: { type: "string", description: "Identificador corto: s1, s2…" },
          kind: { type: "string", enum: STEP_KINDS },
          title: { type: "string" },
          description: { type: "string" },
          connection: { type: "string", enum: [...CONNECTION_KINDS, "none"] },
          requires_approval: { type: "boolean" },
        },
      },
    },
    open_questions: {
      type: "array",
      description: "Lo que hay que preguntar al usuario para completar el flujo.",
      items: { type: "string" },
    },
  },
}

export const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "plan"],
  properties: {
    reply: { type: "string", description: "Respuesta breve al usuario, en español." },
    plan: { anyOf: [{ type: "null" }, planObject] },
  },
}

export type PlanStep = {
  id: string
  kind: string
  title: string
  description: string
  connection: string
  requires_approval: boolean
}

export type Schedule = { frequency: "daily" | "weekdays" | "weekly" | "monthly"; time: string; weekday: number; day_of_month: number }

export function sanitizeSchedule(v: unknown): Schedule | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  if (!["daily", "weekdays", "weekly", "monthly"].includes(String(o.frequency))) return null
  if (typeof o.time !== "string" || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(o.time)) return null
  const weekday = Number.isInteger(o.weekday) && (o.weekday as number) >= 1 && (o.weekday as number) <= 7 ? (o.weekday as number) : 1
  const day = Number.isInteger(o.day_of_month) && (o.day_of_month as number) >= 0 && (o.day_of_month as number) <= 28 ? (o.day_of_month as number) : 1
  return { frequency: o.frequency as Schedule["frequency"], time: o.time, weekday, day_of_month: day }
}

export type Plan = {
  name: string
  summary: string
  trigger: { type: "manual" | "schedule" | "telegram_message" | "email_message" | "whatsapp_message"; description: string; schedule?: Schedule | null }
  connections: { kind: string; purpose: string }[]
  steps: PlanStep[]
  open_questions: string[]
}

// Endurece lo que devuelve el modelo: límites de tamaño y aprobación
// obligatoria en cualquier paso que escriba o envíe algo.
export function sanitizePlan(plan: Plan | null): (Plan & { version: 1 }) | null {
  if (!plan || !Array.isArray(plan.steps)) return null
  const cut = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "")
  const steps = plan.steps.slice(0, 20).map((s, i) => ({
    id: cut(s.id, 12) || `s${i + 1}`,
    kind: STEP_KINDS.includes(s.kind) ? s.kind : "transform",
    title: cut(s.title, 120),
    description: cut(s.description, 600),
    connection: [...CONNECTION_KINDS, "none"].includes(s.connection) ? s.connection : "none",
    // Escribir o enviar a otros requiere aprobación; avisar al propio usuario
    // (notify sin conexión) no.
    requires_approval: s.kind === "write" || (s.kind === "notify" && s.connection !== "none") ? true : Boolean(s.requires_approval),
  }))
  return {
    version: 1,
    name: cut(plan.name, 120) || "Flujo sin nombre",
    summary: cut(plan.summary, 600),
    trigger: {
      type: plan.trigger?.type === "schedule" || plan.trigger?.type === "telegram_message" || plan.trigger?.type === "email_message" ||
          plan.trigger?.type === "whatsapp_message"
        ? plan.trigger.type
        : "manual",
      description: cut(plan.trigger?.description, 200),
      schedule: plan.trigger?.type === "schedule" ? sanitizeSchedule(plan.trigger?.schedule) : null,
    },
    connections: (plan.connections ?? []).slice(0, 10).map((c) => ({
      kind: CONNECTION_KINDS.includes(c.kind) ? c.kind : "documents",
      purpose: cut(c.purpose, 200),
    })),
    steps,
    open_questions: (plan.open_questions ?? []).slice(0, 8).map((q) => cut(q, 300)),
  }
}

// Un solo paso (editor visual, «Complétalo tú»).
export const STEP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "description", "connection"],
  properties: {
    kind: { type: "string", enum: STEP_KINDS },
    title: { type: "string" },
    description: { type: "string" },
    connection: { type: "string", enum: [...CONNECTION_KINDS.filter((c) => c !== "database"), "none"] },
  },
}

export function sanitizeStep(v: unknown): { kind: string; title: string; description: string; connection: string; requires_approval: boolean } {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {}
  const kind = STEP_KINDS.includes(String(o.kind)) ? String(o.kind) : "transform"
  const connection = [...CONNECTION_KINDS, "none"].includes(String(o.connection)) && o.connection !== "database" ? String(o.connection) : "none"
  return {
    kind,
    title: typeof o.title === "string" ? o.title.slice(0, 120) : "",
    description: typeof o.description === "string" ? o.description.slice(0, 600) : "",
    connection,
    requires_approval: kind === "write" || (kind === "notify" && connection !== "none"),
  }
}
