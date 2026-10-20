// Formato interno de un flujo de Delega (versión 1). Lo comparten el
// asistente (que lo genera) y el editor (que lo muestra y, más adelante,
// lo editará y ejecutará). Es JSON Schema estricto para Structured Outputs.

const CONNECTION_KINDS = ["spreadsheet", "documents", "whatsapp", "email", "calendar", "database"]
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
      required: ["type", "description"],
      properties: {
        type: { type: "string", enum: ["manual", "schedule", "whatsapp_message"] },
        description: { type: "string", description: "Cuándo se ejecuta, en palabras (p. ej. 'el día 1 de cada mes' o 'cuando llegue un WhatsApp')." },
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

export type Plan = {
  name: string
  summary: string
  trigger: { type: "manual" | "schedule" | "whatsapp_message"; description: string }
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
    requires_approval: s.kind === "write" || s.kind === "notify" ? true : Boolean(s.requires_approval),
  }))
  return {
    version: 1,
    name: cut(plan.name, 120) || "Flujo sin nombre",
    summary: cut(plan.summary, 600),
    trigger: {
      type: plan.trigger?.type === "schedule" || plan.trigger?.type === "whatsapp_message" ? plan.trigger.type : "manual",
      description: cut(plan.trigger?.description, 200),
    },
    connections: (plan.connections ?? []).slice(0, 10).map((c) => ({
      kind: CONNECTION_KINDS.includes(c.kind) ? c.kind : "documents",
      purpose: cut(c.purpose, 200),
    })),
    steps,
    open_questions: (plan.open_questions ?? []).slice(0, 8).map((q) => cut(q, 300)),
  }
}
