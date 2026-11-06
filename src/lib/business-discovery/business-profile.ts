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

const BOILERPLATE = /^(inicio|home|menu|menú|contacto|contact|sobre nosotros|about us|leer más|read more|ver más|más información|privacy policy|política de privacidad|cookies?|síguenos|follow us|facebook|instagram|linkedin|twitter|x)$/i
const GENERIC = /^(servicios?|services?|empresa|company|soluciones?|solutions?|productos?|products?|online|contacto|contact|software|herramientas|tools|clientes|clients|nosotros|about)$/i

function candidateSentences(page: WebsitePage): { text: string; weight: number }[] {
  const candidates: { text: string; weight: number }[] = []
  const add = (value: string | null | undefined, weight: number) => {
    if (!value) return
    for (const raw of value.split(/(?<=[.!?])\s+|\n+/)) {
      const text = raw.trim().replace(/\s+/g, " ").replace(/^[•·|–—-]+|[•·|–—-]+$/g, "").trim()
      if (text.length < 14 || text.length > 260 || BOILERPLATE.test(text) || GENERIC.test(text)) continue
      if (/^(aceptar|rechazar|configurar|skip to|saltar al contenido)/i.test(text)) continue
      candidates.push({ text, weight })
    }
  }
  add(page.description, 5)
  add(page.title, 4)
  page.headings.forEach((heading) => add(heading, 4))
  add(page.text, 2)
  return candidates
}

function evidence(pages: WebsitePage[], pattern: RegExp): Evidence[] {
  const found = new Map<string, Evidence & { score: number }>()
  for (const page of pages) {
    for (const candidate of candidateSentences(page)) {
      if (!pattern.test(candidate.text)) continue
      const normalized = candidate.text.toLocaleLowerCase()
      const tokens = normalized.split(/\W+/).filter((token) => token.length > 3)
      const specificity = tokens.length >= 6 ? 2 : tokens.length >= 3 ? 1 : 0
      const score = candidate.weight + specificity
      const key = normalized.replace(/[^\p{L}\p{N}]+/gu, " ")
      const previous = found.get(key)
      if (!previous || score > previous.score) found.set(key, { text: candidate.text.slice(0, 240), url: page.url, score })
    }
  }
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, 3)
    .map(({ text, url }) => ({ text, url }))
}

function makeField(items: Evidence[]): BusinessProfileField {
  const distinctPages = new Set(items.map((item) => item.url)).size
  return {
    value: items[0]?.text ?? "",
    evidence: items.map((item) => item.text),
    evidenceSources: items.map((item) => item.url),
    confidence: items.length >= 2 && distinctPages >= 2 ? "high" : items.length ? "medium" : "low",
    source: items.length ? "website" : "not_found",
    confirmed: false,
  }
}

/** Conservative evidence extraction. Generic navigation labels are not treated as business facts. */
export function analyzeBusinessProfile(source: WebsiteSnapshot): BusinessProfile {
  const pages = source.pages?.length ? source.pages : [source]
  const activity = evidence(pages, /\b(clínica|clinic|estudio|studio|agencia|agency|consultor[ií]a|consulting|inmobiliaria|real estate|restaurante|restaurant|taller|workshop|fabricación|manufacturing|inteligencia de mercado|market intelligence|procurement|sourcing|abastecimiento|compras|research|investigación|análisis|analysis|comercio exterior|exportación|importación|logística|healthcare|legal|accounting|engineering|tourism|hospitality)\b/i)
  const clients = evidence(pages, /\b(particulares|empresas|pymes|autónomos|profesionales|familias|pacientes|propietarios|compradores|equipos|importadores|exportadores|inversores|inversionistas|fabricantes|proveedores|distribuidores|instituciones|organizaciones|businesses|companies|investors|buyers|suppliers|manufacturers|entreprises|clients|acheteurs|fournisseurs)\b/i)
  const offer = evidence(pages, /\b(ofrecemos|we offer|realizamos|we provide|ayudamos|we help|tratamientos|treatments|proyectos|projects|catálogo|catalogue|informes|reports|reportes|estudios|studies|diagnósticos|auditorías|inteligencia|market reports|country risk|due diligence|market entry|procurement|sourcing|research|analysis|monitoring|strategy|insights|solutions|services|products|conseil|études|rapports)\b/i)
  const acquisition = evidence(pages, /\b(solicita una cita|reserva|reservar|book a call|schedule a|request a|get in touch|contact us|contacta con|contáctanos|escríbenos|llámanos|presupuesto|newsletter|suscríbete|demander|contacter)\b/i)
  const operations = evidence(pages, /\b(atención personalizada|con cita previa|entrega a domicilio|proceso de|seguimiento de|soporte técnico|monitorización|actualizaciones periódicas|suscripción mensual|research process|monitoring service|delivery process|workflow|accompagnement|suivi personnalisé|livraison)\b/i)
  const tools = evidence(pages, /\b(google workspace|microsoft 365|salesforce|hubspot|holded|excel|teams|slack|sap|oracle|power bi|tableau|sharepoint|notion|airtable|sales navigator|mailchimp|wordpress|shopify|utilizamos [\w -]+|we use [\w -]+|herramientas digitales|software de gestión)\b/i)
  return {
    activity: makeField(activity), clients: makeField(clients), offer: makeField(offer),
    acquisition: makeField(acquisition), operations: makeField(operations), tools: makeField(tools),
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
