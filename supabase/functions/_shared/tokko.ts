// Cliente mínimo de la API de Tokko Broker (v1). La clave de la inmobiliaria
// (MI EMPRESA → PERMISOS en Tokko) vive en Vault y nunca se registra.
//
// - Lectura: propiedades (lista y ficha), emprendimientos.
// - Escritura (siempre con aprobación): registrar una consulta o contacto
//   (webcontact), que entra en el CRM de Tokko asociado a las propiedades.
//
// La búsqueda se hace sobre la cartera de la inmobiliaria (hasta 600
// propiedades) filtrando aquí, para no depender de los identificadores de
// ubicación y tipo de la búsqueda avanzada de Tokko.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

const API = "https://www.tokkobroker.com/api/v1"
const PAGE = 200
const MAX_PROPERTIES = 600

export const TOKKO_KEY_RE = /^[A-Za-z0-9]{20,80}$/

export class TokkoError extends Error {
  constructor(public code: "invalid_key" | "not_found" | "bad_request" | "unavailable", message: string) {
    super(message)
  }
}

async function tk<T>(key: string, path: string, params: Record<string, string> = {}, init: RequestInit = {}): Promise<T> {
  const url = new URL(`${API}${path}`)
  url.searchParams.set("key", key)
  url.searchParams.set("format", "json")
  url.searchParams.set("lang", "es_ar")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30_000) })
  } catch {
    throw new TokkoError("unavailable", "Tokko no respondió a tiempo.")
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 200)
    if (res.status === 401 || res.status === 403) throw new TokkoError("invalid_key", "Tokko no reconoce la clave de API.")
    if (res.status === 404) throw new TokkoError("not_found", "Tokko no encontró ese registro.")
    if (res.status === 400) throw new TokkoError("bad_request", `Tokko rechazó la petición${text ? `: ${text}` : ""}`)
    throw new TokkoError("unavailable", `Error de Tokko (${res.status}).`)
  }
  return (await res.json().catch(() => ({}))) as T
}

type Page<T> = { meta?: { total_count?: number; next?: string | null }; objects?: T[] }

// deno-lint-ignore no-explicit-any
type Raw = Record<string, any>

export async function checkKey(key: string): Promise<{ total: number }> {
  const p = await tk<Page<Raw>>(key, "/property/", { limit: "1" })
  if (!Array.isArray(p.objects)) throw new TokkoError("invalid_key", "Tokko no devolvió propiedades con esa clave.")
  return { total: p.meta?.total_count ?? p.objects.length }
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export type PropertySummary = {
  id: number
  reference: string
  title: string
  type: string
  address: string
  location: string
  operations: { type: string; price: number | null; currency: string }[]
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  surface_total: number | null
  surface_covered: number | null
  url: string | null
}

export function summarize(p: Raw): PropertySummary {
  return {
    id: Number(p.id),
    reference: str(p.reference_code),
    title: str(p.publication_title),
    type: str(p.type?.name),
    address: str(p.fake_address || p.address),
    location: str(p.location?.full_location || p.location?.name),
    operations: (Array.isArray(p.operations) ? p.operations : []).map((o: Raw) => {
      const price = (Array.isArray(o.prices) ? o.prices : [])[0] ?? {}
      return { type: str(o.operation_type), price: num(price.price), currency: str(price.currency) }
    }),
    rooms: num(p.room_amount),
    bedrooms: num(p.suite_amount),
    bathrooms: num(p.bathroom_amount),
    surface_total: num(p.total_surface ?? p.surface),
    surface_covered: num(p.roofed_surface),
    url: typeof p.public_url === "string" ? p.public_url : null,
  }
}

async function allProperties(key: string): Promise<Raw[]> {
  const out: Raw[] = []
  for (let offset = 0; offset < MAX_PROPERTIES; offset += PAGE) {
    const p = await tk<Page<Raw>>(key, "/property/", { limit: String(PAGE), offset: String(offset) })
    const objs = Array.isArray(p.objects) ? p.objects : []
    out.push(...objs)
    if (objs.length < PAGE || !p.meta?.next) break
  }
  return out
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")

export type PropertyFilter = {
  operation?: string | null // "venta" | "alquiler" | "alquiler temporario"
  type?: string | null // "departamento", "casa", "ph", "local"…
  text?: string | null // zona, calle, barrio, palabras del título o la descripción
  price_min?: number | null
  price_max?: number | null
  currency?: string | null // "USD" | "ARS"
  min_rooms?: number | null
  limit?: number | null
}

export function matches(p: PropertySummary & { description?: string }, f: PropertyFilter): boolean {
  if (f.type && !fold(p.type).includes(fold(f.type))) return false
  if (f.min_rooms && (p.rooms ?? 0) < f.min_rooms) return false
  if (f.text) {
    const hay = fold(`${p.title} ${p.address} ${p.location} ${p.reference} ${p.description ?? ""}`)
    if (!fold(f.text).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false
  }
  const ops = p.operations.filter((o) => {
    if (f.operation) {
      const want = fold(f.operation)
      const have = fold(o.type)
      // «alquiler» no incluye «alquiler temporario».
      if (want === "alquiler" ? have !== "alquiler" : !have.includes(want)) return false
    }
    if (f.currency && o.currency && o.currency.toUpperCase() !== f.currency.toUpperCase()) return false
    if (f.price_min != null && (o.price ?? 0) < f.price_min) return false
    if (f.price_max != null && (o.price == null || o.price > f.price_max)) return false
    return true
  })
  return ops.length > 0 || (!f.operation && !f.currency && f.price_min == null && f.price_max == null)
}

export async function searchProperties(key: string, f: PropertyFilter): Promise<{ total: number; found: number; properties: PropertySummary[] }> {
  const all = await allProperties(key)
  const limit = Math.min(Math.max(1, f.limit ?? 10), 25)
  const found = all.map((p) => ({ ...summarize(p), description: str(p.description).slice(0, 2000) })).filter((p) => matches(p, f))
  return {
    total: all.length,
    found: found.length,
    properties: found.slice(0, limit).map(({ description: _d, ...rest }) => rest),
  }
}

export async function getProperty(key: string, id: number) {
  const p = await tk<Raw>(key, `/property/${id}/`)
  return {
    ...summarize(p),
    description: str(p.description || p.rich_description).replace(/<[^>]+>/g, " ").slice(0, 4000),
    expenses: num(p.expenses),
    age: num(p.age),
    parking: num(p.parking_lot_amount),
    photos: (Array.isArray(p.photos) ? p.photos : []).slice(0, 5).map((x: Raw) => str(x.image)).filter(Boolean),
    tags: (Array.isArray(p.tags) ? p.tags : []).map((t: Raw) => str(t.name)).filter(Boolean).slice(0, 30),
    agent: p.producer ? { name: str(p.producer.name), email: str(p.producer.email), phone: str(p.producer.cellphone || p.producer.phone) } : null,
  }
}

export async function listDevelopments(key: string) {
  const p = await tk<Page<Raw>>(key, "/development/", { limit: "50" })
  return (Array.isArray(p.objects) ? p.objects : []).map((d) => ({
    id: Number(d.id),
    name: str(d.name || d.publication_title),
    address: str(d.fake_address || d.address),
    location: str(d.location?.full_location || d.location?.name),
    status: str(d.construction_status ?? d.status),
    url: typeof d.public_url === "string" ? d.public_url : null,
  }))
}

export type LeadInput = { name: string; email: string; phone: string; text: string; property_ids: number[] }

// Registra una consulta en el CRM de Tokko (se asocia a las propiedades).
export async function createLead(key: string, lead: LeadInput): Promise<void> {
  await tk<unknown>(key, "/webcontact/", {}, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: lead.name,
      email: lead.email,
      cellphone: lead.phone,
      phone: lead.phone,
      text: lead.text,
      properties: lead.property_ids,
      tags: ["MarchaSolo"],
    }),
  })
}

export async function tokkoKey(admin: SupabaseClient, workspaceId: string): Promise<string | null> {
  const [{ data }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "tokko" }),
    admin.from("integrations").select("status").eq("workspace_id", workspaceId).eq("provider", "tokko").maybeSingle(),
  ])
  const secret = (data?.[0] as { refresh_token?: string } | undefined)?.refresh_token
  return secret && integ?.status === "active" ? secret : null
}
