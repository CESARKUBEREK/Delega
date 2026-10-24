// Herramientas del agente para Tokko Broker y Xubio.
// - Lecturas sin aprobación (propiedades, emprendimientos, datos contables).
// - Tokko: registrar una consulta en su CRM espera aprobación.
// - Xubio: solo lectura.
import type { ToolDef } from "./llm.ts"
import { getProperty, listDevelopments, searchProperties, TokkoError } from "./tokko.ts"
import { type XubioCredentials, XubioError, xubioGet, xubioList, type XubioResource, XUBIO_RESOURCES, xubioToken } from "./xubio.ts"

export type BusinessResources = { tokko: string | null; xubio: XubioCredentials | null }

export type TokkoLeadPending = {
  call_id: string
  tool: "tokko_lead"
  name: string
  email: string
  phone: string
  text: string
  property_ids: number[]
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/
const NULLABLE_NUM = { type: ["number", "null"] }
const RESOURCE_NAMES = Object.keys(XUBIO_RESOURCES) as XubioResource[]

function fn(name: string, description: string, properties: Record<string, unknown>): ToolDef {
  return {
    name,
    description,
    parameters: { type: "object", additionalProperties: false, required: Object.keys(properties), properties },
  }
}

export function businessTools(r: BusinessResources): ToolDef[] {
  const tools: ToolDef[] = []
  if (r.tokko) {
    tools.push(
      fn("tokko_search", "Busca propiedades en la cartera de Tokko Broker de la inmobiliaria. Devuelve fichas resumidas.", {
        operation: { type: "string", enum: ["venta", "alquiler", "alquiler temporario", "cualquiera"] },
        type: { type: "string", description: "Tipo de propiedad (departamento, casa, PH, local, terreno, oficina…); vacío = cualquiera." },
        text: { type: "string", description: "Zona, barrio, calle o palabras de la ficha; vacío = sin filtro." },
        price_min: NULLABLE_NUM,
        price_max: NULLABLE_NUM,
        currency: { type: "string", enum: ["USD", "ARS", "cualquiera"] },
        min_rooms: { type: ["integer", "null"], description: "Ambientes mínimos." },
        limit: { type: "integer", description: "Máximo de resultados (1-25)." },
      }),
      fn("tokko_property", "Devuelve la ficha completa de una propiedad de Tokko (descripción, fotos, enlace, agente).", {
        id: { type: "integer" },
      }),
      fn("tokko_developments", "Lista los emprendimientos de la inmobiliaria en Tokko.", {}),
      fn(
        "tokko_register_lead",
        "Registra una consulta o un contacto interesado en el CRM de Tokko, asociado a las propiedades. Requiere aprobación.",
        {
          name: { type: "string" },
          email: { type: "string", description: "Correo del interesado; vacío si no se conoce." },
          phone: { type: "string", description: "Teléfono; vacío si no se conoce." },
          text: { type: "string", description: "Qué consulta o busca." },
          property_ids: { type: "array", items: { type: "integer" }, description: "Ids de propiedades de Tokko (puede estar vacío)." },
        },
      ),
    )
  }
  if (r.xubio) {
    const resource = { type: "string", enum: RESOURCE_NAMES }
    tools.push(
      fn("xubio_list", "Lista registros de Xubio (contabilidad): clientes, proveedores, productos, facturas de venta o de compra. Solo lectura.", {
        resource,
        date_from: { type: ["string", "null"], description: "Solo facturas: desde AAAA-MM-DD." },
        date_to: { type: ["string", "null"], description: "Solo facturas: hasta AAAA-MM-DD." },
        limit: { type: "integer", description: "Máximo de registros (1-100)." },
      }),
      fn("xubio_get", "Devuelve un registro de Xubio por su id. Solo lectura.", { resource, id: { type: "string" } }),
    )
  }
  return tools
}

export const BUSINESS_READS = new Set(["tokko_search", "tokko_property", "tokko_developments", "xubio_list", "xubio_get"])

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)

export async function businessRead(
  name: string,
  args: Record<string, unknown>,
  r: BusinessResources,
  cache: { xubioToken?: string },
): Promise<{ out: unknown; title: string }> {
  try {
    if (name.startsWith("tokko_")) {
      if (!r.tokko) return { out: { error: "Tokko no está conectado." }, title: "Tokko no está conectado" }
      if (name === "tokko_search") {
        const operation = s(args.operation, 40)
        const currency = s(args.currency, 10)
        const res = await searchProperties(r.tokko, {
          operation: operation && operation !== "cualquiera" ? operation : null,
          type: s(args.type, 60) || null,
          text: s(args.text, 120) || null,
          price_min: n(args.price_min),
          price_max: n(args.price_max),
          currency: currency && currency !== "cualquiera" ? currency : null,
          min_rooms: n(args.min_rooms),
          limit: n(args.limit),
        })
        return { out: res, title: `Buscó en Tokko: ${res.found} de ${res.total} propiedades coinciden` }
      }
      if (name === "tokko_property") {
        const id = n(args.id)
        if (!id) return { out: { error: "Falta el id de la propiedad." }, title: "Propiedad no válida" }
        const p = await getProperty(r.tokko, Math.trunc(id))
        return { out: p, title: `Leyó la ficha de «${p.title || p.address}» en Tokko` }
      }
      const list = await listDevelopments(r.tokko)
      return { out: { developments: list }, title: `Revisó ${list.length} emprendimientos en Tokko` }
    }
    if (!r.xubio) return { out: { error: "Xubio no está conectado." }, title: "Xubio no está conectado" }
    const resource = s(args.resource, 40) as XubioResource
    if (!RESOURCE_NAMES.includes(resource)) return { out: { error: "Recurso no válido." }, title: "Consulta a Xubio no válida" }
    cache.xubioToken ??= await xubioToken(r.xubio)
    if (name === "xubio_list") {
      const res = await xubioList(cache.xubioToken, resource, {
        date_from: s(args.date_from, 10) || null,
        date_to: s(args.date_to, 10) || null,
        limit: n(args.limit),
      })
      return { out: res, title: `Consultó ${res.count} registros de ${resource.replace("_", " ")} en Xubio` }
    }
    const item = await xubioGet(cache.xubioToken, resource, s(args.id, 30))
    return { out: item, title: `Leyó un registro de ${resource.replace("_", " ")} en Xubio` }
  } catch (e) {
    const msg = e instanceof TokkoError || e instanceof XubioError ? e.message : "No se pudo completar la consulta."
    return { out: { error: msg }, title: msg }
  }
}

export function tokkoLeadPending(callId: string, args: Record<string, unknown>, r: BusinessResources): TokkoLeadPending | string {
  if (!r.tokko) return "Tokko no está conectado."
  const name = s(args.name, 120).trim()
  const email = s(args.email, 200).trim()
  const phone = s(args.phone, 40).trim()
  const text = s(args.text, 4000).trim()
  const ids = (Array.isArray(args.property_ids) ? args.property_ids : [])
    .filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0)
    .slice(0, 10)
  if (!name) return "Falta el nombre del interesado."
  if (email && !EMAIL_RE.test(email)) return "El correo no es válido."
  if (!email && !phone) return "Hace falta un correo o un teléfono."
  if (!text) return "Falta el texto de la consulta."
  return { call_id: callId, tool: "tokko_lead", name, email, phone, text, property_ids: ids }
}
