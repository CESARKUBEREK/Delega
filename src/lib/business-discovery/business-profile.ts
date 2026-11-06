import type { WebsiteSnapshot, WebsitePage } from "./website-parser"

export type BusinessProfileField = {
  value: string
  evidence: string[]
  evidenceSources: string[]
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

type Evidence = { text: string; url: string }

function evidence(pages: WebsitePage[], pattern: RegExp): Evidence[] {
  const seen = new Set<string>()
  const matches: Evidence[] = []
  for (const page of pages) {
    // Prioriza metadatos y encabezados frente a texto genérico de navegación/pie.
    const text = [page.title, page.siteName, page.description, ...page.headings, page.text].filter(Boolean).join("\\n")
    for (const sentence of text.split(/(?<=[.!?])\\s+|\\n+/)) {
      const normalized = sentence.trim().replace(/\\s+/g, " ")
      if (!normalized || normalized.length < 3 || !pattern.test(normalized) || seen.has(normalized)) continue
      seen.add(normalized)
      matches.push({ text: normalized.slice(0, 240), url: page.url })
      if (matches.length >= 3) return matches
    }
  }
  return matches
}

function makeField(items: Evidence[]): BusinessProfileField {
  return {
    value: items[0]?.text ?? "",
    evidence: items.map((item) => item.text),
    evidenceSources: items.map((item) => item.url),
    confidence: items.length >= 2 ? "medium" : "low",
    source: items.length ? "website" : "not_found",
    confirmed: false,
  }
}

/** Extracts clues supported by visible website text; it never fills gaps by guessing. */
export function analyzeBusinessProfile(source: WebsiteSnapshot): BusinessProfile {
  const pages = source.pages?.length ? source.pages : [source]
  const activity = evidence(pages, /\b(servicios?|empresa|estudio|agencia|consultor[ií]a|cl[ií]nica|inmobiliaria|restaurante|taller|fabricaci[oó]n|alquiler|asesor[ií]a)\b/i)
  const clients = evidence(pages, /\b(particulares|empresas|pymes|aut[oó]nomos|profesionales|familias|pacientes|propietarios|compradores|equipos)\b/i)
  const offer = evidence(pages, /\b(servicios?|soluciones|productos|ofrecemos|realizamos|ayudamos|tratamientos|proyectos|cat[aá]logo)\b/i)
  const acquisition = evidence(pages, /\b(contacto|contactar|presupuesto|reserva|reservar|cita|agenda|solicita|whatsapp|tel[eé]fono|formulario)\b/i)
  const operations = evidence(pages, /\b(horario|atenci[oó]n|entrega|proceso|visita|urgencias|soporte|seguimiento|presencial|online)\b/i)
  const tools = evidence(pages, /\b(software|plataforma|crm|erp|google workspace|microsoft 365|salesforce|hubspot|holded|excel|teams|slack)\b/i)

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
