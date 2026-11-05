export type BusinessProfileField = {
  value: string
  evidence: string[]
  confidence: "high" | "medium" | "low"
  source: "website" | "not_found"
  confirmed: false
}

export type BusinessProfile = {
  activity: BusinessProfileField
  clients: BusinessProfileField
  offer: BusinessProfileField
  acquisition: BusinessProfileField
  operations: BusinessProfileField
  tools: BusinessProfileField
}

type WebsiteSource = {
  url: string
  title: string | null
  description: string | null
  headings: string[]
  text: string
}

const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, 3)

function evidence(text: string, pattern: RegExp): string[] {
  return unique(
    text.split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => pattern.test(sentence))
      .map((sentence) => sentence.slice(0, 240)),
  )
}

function makeField(items: string[], confidence: BusinessProfileField["confidence"]): BusinessProfileField {
  return {
    value: items[0] ?? "",
    evidence: items,
    confidence: items.length ? confidence : "low",
    source: items.length ? "website" : "not_found",
    confirmed: false,
  }
}

/** Extracts clues supported by visible website text; it never fills gaps by guessing. */
export function analyzeBusinessProfile(source: WebsiteSource): BusinessProfile {
  const text = [source.title, source.description, ...source.headings, source.text].filter(Boolean).join("\n")
  const activity = evidence(text, /\b(servicios?|empresa|estudio|agencia|consultor[ií]a|cl[ií]nica|inmobiliaria|restaurante|taller|fabricaci[oó]n|alquiler|asesor[ií]a)\b/i)
  const clients = evidence(text, /\b(particulares|empresas|pymes|aut[oó]nomos|profesionales|familias|pacientes|propietarios|compradores|equipos)\b/i)
  const offer = evidence(text, /\b(servicios?|soluciones|productos|ofrecemos|realizamos|ayudamos|tratamientos|proyectos|cat[aá]logo)\b/i)
  const acquisition = evidence(text, /\b(contacto|contactar|presupuesto|reserva|reservar|cita|agenda|solicita|whatsapp|tel[eé]fono|formulario)\b/i)
  const operations = evidence(text, /\b(horario|atenci[oó]n|entrega|proceso|visita|urgencias|soporte|seguimiento|presencial|online)\b/i)
  const tools = evidence(text, /\b(software|plataforma|crm|erp|google workspace|microsoft 365|salesforce|hubspot|holded|excel|teams|slack)\b/i)

  return {
    activity: makeField(activity, "medium"),
    clients: makeField(clients, "medium"),
    offer: makeField(offer, "medium"),
    acquisition: makeField(acquisition, "medium"),
    operations: makeField(operations, "low"),
    tools: makeField(tools, "low"),
  }
}

export const BUSINESS_PROFILE_FIELDS = [
  { key: "activity", label: "Actividad del negocio", hint: "Qué hace la empresa" },
  { key: "clients", label: "Clientes", hint: "A quién atiende" },
  { key: "offer", label: "Servicios o productos", hint: "Qué ofrece" },
  { key: "acquisition", label: "Captación y contacto", hint: "Cómo llegan los clientes" },
  { key: "operations", label: "Forma de trabajar", hint: "Cómo organiza la atención y las operaciones" },
  { key: "tools", label: "Herramientas actuales", hint: "Software o aplicaciones mencionadas" },
] as const
