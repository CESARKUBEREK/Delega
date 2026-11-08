import { asPlan, type FlowPlan } from "@/lib/plan"
import type { BusinessProfile } from "@/lib/business-discovery/business-profile"
import type { WebsiteSnapshot, WebsitePage } from "@/lib/business-discovery/website-parser"

export type OnboardingConnection =
  | "email"
  | "messaging"
  | "whatsapp"
  | "telegram"
  | "spreadsheet"
  | "documents"
  | "drive"
  | "calendar"
  | "crm"
  | "contacts"
  | "properties"
  | "accounting"
  | "social"
  | "database"
  | "none"

// Cada capability del plan apunta al proveedor real que la satisface.
// Mantener este catálogo alineado con los providers de Integraciones.
export const ONBOARDING_CONNECTIONS: Exclude<OnboardingConnection, "none">[] = [
  "email", "whatsapp", "telegram", "spreadsheet", "documents", "drive", "calendar",
  "crm", "contacts", "properties", "accounting", "social", "database",
]

const CONNECTION_KIND_MAP: Record<string, OnboardingConnection[]> = {
  email: ["email"],
  email_message: ["email"],
  whatsapp: ["whatsapp"],
  whatsapp_message: ["whatsapp"],
  telegram: ["telegram"],
  telegram_message: ["telegram"],
  spreadsheet: ["spreadsheet"],
  documents: ["documents"],
  drive: ["drive"],
  calendar: ["calendar"],
  crm: ["crm"],
  contacts: ["contacts"],
  properties: ["properties"],
  accounting: ["accounting"],
  social: ["social"],
  database: ["database"],
}

// Devuelve todas las conexiones distintas que necesita el plan, en orden estable.
// También contempla el canal de entrada declarado en el disparador.
export function requiredConnections(plan: FlowPlan): OnboardingConnection[] {
  const kinds = new Set([
    ...plan.connections.map((c) => c.kind),
    ...plan.steps.map((s) => s.connection),
    plan.trigger.type,
  ])
  const required = new Set<OnboardingConnection>()
  for (const kind of kinds) {
    for (const connection of CONNECTION_KIND_MAP[kind] ?? []) required.add(connection)
  }
  return ONBOARDING_CONNECTIONS.filter((connection) => required.has(connection))
}

// Compatibilidad para pantallas que solo muestran la primera conexión.
export function primaryConnection(plan: FlowPlan): OnboardingConnection {
  return requiredConnections(plan)[0] ?? "none"
}

export const CONNECTION_LABEL: Record<OnboardingConnection, string> = {
  email: "Correo (IMAP)",
  messaging: "WhatsApp / Telegram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  spreadsheet: "Google Sheets / Excel",
  documents: "Google Docs",
  drive: "Google Drive",
  calendar: "Google Calendar",
  crm: "HubSpot",
  contacts: "Google Contacts",
  properties: "Tokko Broker",
  accounting: "Xubio",
  social: "Buffer",
  database: "Base de datos Supabase",
  none: "Ninguna por ahora",
}

// Sección de Integraciones donde está la tarjeta o el proveedor requerido.
export const CONNECTION_ANCHOR: Record<OnboardingConnection, string> = {
  email: "comunicaciones",
  messaging: "comunicaciones",
  whatsapp: "comunicaciones",
  telegram: "comunicaciones",
  spreadsheet: "calculos",
  documents: "textos",
  drive: "drives",
  calendar: "calendar",
  crm: "crm",
  contacts: "crm",
  properties: "inmobiliaria",
  accounting: "contabilidad",
  social: "redes-sociales",
  database: "bases-de-datos",
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
  businessContext?: {
    websiteUrl: string
    websiteSnapshot: WebsiteSnapshot | null
    businessProfile: BusinessProfile | null
    profileConfirmed: boolean
    businessType: string
    mainPain: string
    channels: string[]
  } | null
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
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isWebsitePage(value: unknown): value is WebsitePage {
  if (!isRecord(value)) return false
  return typeof value.url === "string"
    && (typeof value.title === "string" || value.title === null)
    && (typeof value.description === "string" || value.description === null)
    && Array.isArray(value.headings) && value.headings.every((item) => typeof item === "string")
    && typeof value.text === "string"
}

function readBusinessProfile(value: unknown): BusinessProfile | null {
  if (!isRecord(value)) return null
  const keys = ["activity", "clients", "offer", "acquisition", "operations", "tools"] as const
  const result = {} as BusinessProfile
  for (const key of keys) {
    const field = value[key]
    if (!isRecord(field) || typeof field.value !== "string"
      || !Array.isArray(field.evidence) || !field.evidence.every((item) => typeof item === "string")
      || !Array.isArray(field.evidenceSources) || !field.evidenceSources.every((item) => typeof item === "string")
      || !["high", "medium", "low"].includes(String(field.confidence))
      || !["website", "user", "not_found"].includes(String(field.source))) return null
    result[key] = {
      value: field.value.slice(0, 2_000),
      evidence: field.evidence.slice(0, 3).map((item) => item.slice(0, 240)),
      evidenceSources: field.evidenceSources.slice(0, 3).map((item) => item.slice(0, 2_048)),
      confidence: field.confidence as BusinessProfile["activity"]["confidence"],
      source: field.source as BusinessProfile["activity"]["source"],
      confirmed: false,
    }
  }
  return result
}

function readBusinessContext(value: unknown): OnboardingSnapshot["businessContext"] {
  if (!isRecord(value)) return null
  const candidate = value.websiteSnapshot
  const pages = isRecord(candidate) && Array.isArray(candidate.pages) ? candidate.pages : null
  const snapshot = isRecord(candidate) && pages !== null && pages.length > 0 && pages.length <= 3
    && pages.every(isWebsitePage) && isWebsitePage(candidate)
    ? { ...candidate, pages } as WebsiteSnapshot : null
  const profile = readBusinessProfile(value.businessProfile)
  return {
    websiteUrl: typeof value.websiteUrl === "string" ? value.websiteUrl.slice(0, 2_048) : "",
    websiteSnapshot: snapshot,
    businessProfile: profile,
    profileConfirmed: value.profileConfirmed === true && snapshot !== null && profile !== null,
    businessType: typeof value.businessType === "string" ? value.businessType.slice(0, 40) : "",
    mainPain: typeof value.mainPain === "string" ? value.mainPain.slice(0, 40) : "",
    channels: Array.isArray(value.channels) ? value.channels.filter((item): item is string => typeof item === "string").slice(0, 6) : [],
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
      businessContext: readBusinessContext(v.businessContext),
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

// WhatsApp (Twilio + aprobación de Meta) puede tardar días en conectarse. En
// el onboarding se ofrece empezar con el correo: la misma automatización,
// cambiando el canal, y una nota para sumar WhatsApp cuando esté listo.
export const WHATSAPP_LATER_NOTE = "Sumar WhatsApp cuando esté conectado (Integraciones → Comunicaciones)."

export function usesWhatsapp(plan: FlowPlan): boolean {
  return requiredConnections(plan).includes("whatsapp")
}

export function planWithEmailInsteadOfWhatsapp(plan: FlowPlan): FlowPlan {
  const swap = (text: string) =>
    text
      .replace(/\bun WhatsApp\b/g, "un correo")
      .replace(/\bpor WhatsApp\b/g, "por correo")
      .replace(/\bWhatsApp\b/g, "correo")
  const connections: FlowPlan["connections"] = []
  for (const c of plan.connections) {
    const kind = c.kind === "whatsapp" ? "email" : c.kind
    if (connections.some((x) => x.kind === kind)) continue
    connections.push({ kind, purpose: swap(c.purpose) })
  }
  return {
    ...plan,
    name: swap(plan.name),
    summary: swap(plan.summary),
    trigger:
      plan.trigger.type === "whatsapp_message"
        ? { type: "email_message", description: swap(plan.trigger.description) || "Al recibir un correo" }
        : { ...plan.trigger, description: swap(plan.trigger.description) },
    connections,
    steps: plan.steps.map((s) =>
      s.connection === "whatsapp"
        ? { ...s, connection: "email", title: swap(s.title), description: swap(s.description) }
        : { ...s, title: swap(s.title), description: swap(s.description) },
    ),
    open_questions: plan.open_questions.includes(WHATSAPP_LATER_NOTE)
      ? plan.open_questions
      : [...plan.open_questions, WHATSAPP_LATER_NOTE],
  }
}
