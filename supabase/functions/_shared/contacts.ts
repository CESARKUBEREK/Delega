// Cliente mínimo de Google Contacts (People API), para quien no usa un CRM.
// Usa el refresh token del espacio (provider "contacts"). Nunca registra
// tokens ni contenidos.
// - Buscar contactos (lectura libre).
// - Crear un contacto (siempre con aprobación, desde el agente).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { accessTokenFrom, GoogleError } from "./google.ts"

export const CONTACTS_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/contacts"]
export const CONTACTS_REQUIRED = ["https://www.googleapis.com/auth/contacts"]
const API = "https://people.googleapis.com/v1"
const READ_MASK = "names,emailAddresses,phoneNumbers,organizations,biographies"

async function people<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new GoogleError("unavailable", "Google Contacts no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) {
    const detail = data?.error?.message ? `: ${String(data.error.message).slice(0, 200)}` : ""
    if (res.status === 401 || res.status === 403) throw new GoogleError("forbidden", `Google Contacts denegó el acceso${detail}`)
    if (res.status === 400) throw new GoogleError("bad_request", `Petición no válida${detail}`)
    if (res.status === 429) throw new GoogleError("unavailable", "Google Contacts pide esperar un momento.")
    throw new GoogleError("unavailable", `Error de Google Contacts (${res.status})${detail}`)
  }
  return data
}

export type ContactsConfig = { email?: string | null }

// Access token de Contacts del espacio (o error claro si Google retiró el acceso).
export async function contactsToken(admin: SupabaseClient, workspaceId: string): Promise<{ token: string; config: ContactsConfig }> {
  const [{ data: secretRows }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "contacts" }),
    admin.from("integrations").select("status, config").eq("workspace_id", workspaceId).eq("provider", "contacts").maybeSingle(),
  ])
  const secret = secretRows?.[0] as { refresh_token: string } | undefined
  if (!secret || !integ) throw new GoogleError("not_found", "Google Contacts no está conectado.")
  if (integ.status !== "active") throw new GoogleError("invalid_grant", "Google retiró el acceso a Contacts. Vuelve a conectarlo.")
  try {
    const { token } = await accessTokenFrom(secret.refresh_token)
    return { token, config: (integ.config ?? {}) as ContactsConfig }
  } catch (e) {
    if (e instanceof GoogleError && e.code === "invalid_grant") {
      await admin.rpc("integration_mark_invalid", { p_workspace_id: workspaceId, p_provider: "contacts" })
      throw new GoogleError("invalid_grant", "Google retiró el acceso a Contacts. Vuelve a conectarlo.")
    }
    throw e
  }
}

export type ContactSummary = {
  id: string
  name: string | null
  emails: string[]
  phones: string[]
  company: string | null
  notes: string | null
}

type Person = {
  resourceName?: string
  names?: { displayName?: string }[]
  emailAddresses?: { value?: string }[]
  phoneNumbers?: { value?: string }[]
  organizations?: { name?: string; title?: string }[]
  biographies?: { value?: string }[]
}

export function summarizePerson(p: Person): ContactSummary {
  const org = p.organizations?.[0]
  return {
    id: (p.resourceName ?? "").replace(/^people\//, ""),
    name: p.names?.[0]?.displayName?.trim() || null,
    emails: (p.emailAddresses ?? []).map((e) => (e.value ?? "").trim().toLowerCase()).filter(Boolean).slice(0, 5),
    phones: (p.phoneNumbers ?? []).map((e) => (e.value ?? "").trim()).filter(Boolean).slice(0, 5),
    company: [org?.name, org?.title].filter(Boolean).join(" · ") || null,
    notes: p.biographies?.[0]?.value?.slice(0, 500) ?? null,
  }
}

// La búsqueda de People API necesita una consulta vacía previa para «calentar»
// la caché; si no, puede devolver resultados vacíos las primeras veces.
const warmed = new Set<string>()

export async function searchContacts(token: string, query: string, limit = 10): Promise<ContactSummary[]> {
  const q = query.trim().slice(0, 100)
  const key = token.slice(-12)
  if (!warmed.has(key)) {
    warmed.add(key)
    await people(token, `people:searchContacts?query=&readMask=${READ_MASK}`).catch(() => null)
  }
  if (!q) {
    const data = await people<{ connections?: Person[] }>(
      token,
      `people/me/connections?pageSize=${Math.min(Math.max(limit, 1), 30)}&sortOrder=LAST_MODIFIED_DESCENDING&personFields=${READ_MASK}`,
    )
    return (data.connections ?? []).map(summarizePerson)
  }
  const data = await people<{ results?: { person?: Person }[] }>(
    token,
    `people:searchContacts?query=${encodeURIComponent(q)}&pageSize=${Math.min(Math.max(limit, 1), 30)}&readMask=${READ_MASK}`,
  )
  return (data.results ?? []).map((r) => summarizePerson(r.person ?? {}))
}

// Contacto con exactamente esa dirección de correo, si lo hay.
export async function findContactByEmail(token: string, email: string): Promise<ContactSummary | null> {
  const address = email.trim().toLowerCase()
  if (!address.includes("@")) return null
  const found = await searchContacts(token, address, 5)
  return found.find((c) => c.emails.includes(address)) ?? null
}

export type NewContact = { name: string; email: string | null; phone: string | null; company: string | null; notes: string | null }

export async function createContact(token: string, c: NewContact): Promise<ContactSummary> {
  const body: Record<string, unknown> = { names: [{ unstructuredName: c.name.slice(0, 200) }] }
  if (c.email) body.emailAddresses = [{ value: c.email.slice(0, 320) }]
  if (c.phone) body.phoneNumbers = [{ value: c.phone.slice(0, 40) }]
  if (c.company) body.organizations = [{ name: c.company.slice(0, 200) }]
  if (c.notes) body.biographies = [{ value: c.notes.slice(0, 2000), contentType: "TEXT_PLAIN" }]
  const p = await people<Person>(token, `people:createContact?personFields=${READ_MASK}`, { method: "POST", body: JSON.stringify(body) })
  return summarizePerson(p)
}
