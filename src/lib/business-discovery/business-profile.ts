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
    const text = [page.title, page.siteName, page.description, ...page.headings, page.text].filter(Boolean).join("\n")
    for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
      const normalized = sentence.trim().replace(/\s+/g, " ")
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
  // Vocabulario multilingüe y sectorial: muchas webs describen lo que hacen sin
  // utilizar literalmente etiquetas como "servicios" o "empresa".
  const activity = evidence(pages, /\b(servicios?|empresa|estudio|agencia|consultor[ií]a|cl[ií]nica|inmobiliaria|restaurante|taller|fabricaci[oó]n|alquiler|asesor[ií]a|inteligencia de mercado|market intelligence|procurement|sourcing|abastecimiento|compras|investigaci[oó]n|research|an[aá]lisis|analysis|comercio exterior|exportaci[oó]n|importaci[oó]n|log[ií]stica|real estate|healthcare|legal|accounting|engineering|manufacturing|tourism|hospitality)\b/i)
  const clients = evidence(pages, /\b(particulares|empresas|pymes|aut[oó]nomos|profesionales|familias|pacientes|propietarios|compradores|equipos|importadores|exportadores|inversores|inversionistas|fabricantes|proveedores|distribuidores|instituciones|organizaciones|businesses|companies|investors|buyers|suppliers|manufacturers|entreprises|clients|acheteurs|fournisseurs)\b/i)
  const offer = evidence(pages, /\b(servicios?|soluciones|productos|ofrecemos|realizamos|ayudamos|tratamientos|proyectos|cat[aá]logo|informes?|reportes?|estudios|diagn[oó]sticos|auditor[ií]as|inteligencia|informaci[oó]n|datos|asesoramiento|consultor[ií]a|market reports|country risk|due diligence|market entry|procurement|sourcing|research|analysis|monitoring|strategy|reports|insights|solutions|services|products|conseil|études|rapports|veille)\b/i)
  const acquisition = evidence(pages, /\b(contacto|contactar|presupuesto|reserva|reservar|cita|agenda|solicita|whatsapp|tel[eé]fono|formulario|escr[ií]benos|ll[aá]manos|book a call|schedule|request|enquiry|inquiry|get in touch|contact us|subscribe|newsletter|demander|contacter)\b/i)
  const operations = evidence(pages, /\b(horario|atenci[oó]n|entrega|proceso|visita|urgencias|soporte|seguimiento|presencial|online|investigaci[oó]n|an[aá]lisis|evaluaci[oó]n|monitorizaci[oó]n|actualizaci[oó]n|publicaci[oó]n|suscripci[oó]n|asesoramiento|consultor[ií]a|research|analysis|monitoring|tracking|updates|subscription|delivery|workflow|process|support|accompagnement|suivi|livraison)\b/i)
  const tools = evidence(pages, /\b(software|plataforma|crm|erp|google workspace|microsoft 365|salesforce|hubspot|holded|excel|teams|slack|sap|oracle|power bi|tableau|sharepoint|notion|airtable|sales navigator|mailchimp|wordpress|shopify|herramientas|tools|technology|technologies|outil|logiciel)\b/i)

  return {
    activity: makeField(activity),
    clients: makeField(clients),
    offer: makeField(offer),
    acquisition: makeField(acquisition),
    operations: makeField(operations),
    tools: makeField(tools),
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
