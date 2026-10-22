// Cliente mínimo de la API de HubSpot (CRM v3). La clave (clave de servicio
// o token de app privada) vive en Vault; nunca se registra.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

const API = "https://api.hubapi.com"

export class HubSpotError extends Error {
  constructor(public code: "invalid_token" | "forbidden" | "not_found" | "bad_request" | "rate_limited" | "unavailable", message: string) {
    super(message)
  }
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{20,300}$/
export const CRM_OBJECTS = ["contacts", "companies", "deals"] as const
export type CrmObject = (typeof CRM_OBJECTS)[number]

export const OBJECT_LABEL: Record<CrmObject, string> = { contacts: "contacto", companies: "empresa", deals: "negocio" }

// Propiedades que se leen por defecto de cada objeto.
export const DEFAULT_PROPERTIES: Record<CrmObject, string[]> = {
  contacts: ["firstname", "lastname", "email", "phone", "company", "jobtitle", "lifecyclestage", "hs_lead_status"],
  companies: ["name", "domain", "city", "phone", "industry", "lifecyclestage"],
  deals: ["dealname", "amount", "dealstage", "pipeline", "closedate", "hs_deal_stage_probability"],
}

// Tipos de asociación definidos por HubSpot (nota/tarea → objeto).
const NOTE_ASSOC: Record<CrmObject, number> = { contacts: 202, companies: 190, deals: 214 }
const TASK_ASSOC: Record<CrmObject, number> = { contacts: 204, companies: 192, deals: 216 }

async function hs<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new HubSpotError("unavailable", "HubSpot no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; category?: string }
  if (!res.ok) {
    const detail = data?.message ? `: ${String(data.message).slice(0, 240)}` : ""
    if (res.status === 401) throw new HubSpotError("invalid_token", "HubSpot no reconoce la clave.")
    if (res.status === 403) throw new HubSpotError("forbidden", `La clave de HubSpot no tiene permiso para esto${detail}`)
    if (res.status === 404) throw new HubSpotError("not_found", `HubSpot no encontró el registro${detail}`)
    if (res.status === 429) throw new HubSpotError("rate_limited", "HubSpot pide esperar un momento (límite de peticiones).")
    if (res.status === 400 || res.status === 409) throw new HubSpotError("bad_request", `HubSpot rechazó la petición${detail}`)
    throw new HubSpotError("unavailable", `Error de HubSpot (${res.status}).`)
  }
  return data
}

export async function accountInfo(token: string): Promise<{ portalId: number | null; uiDomain: string | null; timeZone: string | null }> {
  try {
    const d = await hs<{ portalId?: number; uiDomain?: string; timeZone?: string }>(token, "/account-info/v3/details")
    return { portalId: d.portalId ?? null, uiDomain: d.uiDomain ?? null, timeZone: d.timeZone ?? null }
  } catch (e) {
    // Algunas claves no tienen acceso a account-info: se comprueba con contactos.
    if (e instanceof HubSpotError && e.code === "forbidden") {
      await hs(token, "/crm/v3/objects/contacts?limit=1")
      return { portalId: null, uiDomain: null, timeZone: null }
    }
    throw e
  }
}

export type CrmRecord = { id: string; properties: Record<string, string | null>; url: string | null }

function recordUrl(portalId: number | null | undefined, object: CrmObject, id: string): string | null {
  if (!portalId) return null
  const type = object === "contacts" ? "0-1" : object === "companies" ? "0-2" : "0-3"
  return `https://app.hubspot.com/contacts/${portalId}/record/${type}/${id}`
}

export async function search(token: string, object: CrmObject, query: string, limit: number, portalId?: number | null): Promise<CrmRecord[]> {
  const data = await hs<{ results?: { id: string; properties: Record<string, string | null> }[] }>(token, `/crm/v3/objects/${object}/search`, {
    method: "POST",
    body: JSON.stringify({
      query: query.slice(0, 200) || undefined,
      limit: Math.min(Math.max(limit, 1), 50),
      properties: DEFAULT_PROPERTIES[object],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
    }),
  })
  return (data.results ?? []).map((r) => ({ id: r.id, properties: r.properties, url: recordUrl(portalId, object, r.id) }))
}

export function recordLabel(object: CrmObject, p: Record<string, string | null | undefined>): string {
  if (object === "contacts") return [p.firstname, p.lastname].filter(Boolean).join(" ") || p.email || "contacto"
  if (object === "companies") return p.name || p.domain || "empresa"
  return p.dealname || "negocio"
}

export async function getRecord(token: string, object: CrmObject, id: string, portalId?: number | null, extra: string[] = []) {
  const assoc = CRM_OBJECTS.filter((o) => o !== object).join(",")
  const props = [...new Set([...DEFAULT_PROPERTIES[object], ...extra])].join(",")
  const data = await hs<{
    id: string
    properties: Record<string, string | null>
    associations?: Record<string, { results?: { id: string }[] }>
  }>(token, `/crm/v3/objects/${object}/${encodeURIComponent(id)}?properties=${encodeURIComponent(props)}&associations=${assoc}`)
  const associations: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(data.associations ?? {})) associations[k] = (v.results ?? []).map((r) => r.id).slice(0, 20)
  return { id: data.id, properties: data.properties, associations, url: recordUrl(portalId, object, data.id) }
}

export async function dealPipelines(token: string) {
  const data = await hs<{ results?: { id: string; label: string; stages?: { id: string; label: string }[] }[] }>(token, "/crm/v3/pipelines/deals")
  return (data.results ?? []).map((p) => ({ id: p.id, label: p.label, stages: (p.stages ?? []).map((s) => ({ id: s.id, label: s.label })) }))
}

export async function createRecord(token: string, object: CrmObject, properties: Record<string, string>) {
  return await hs<{ id: string; properties: Record<string, string | null> }>(token, `/crm/v3/objects/${object}`, {
    method: "POST",
    body: JSON.stringify({ properties }),
  })
}

export async function updateRecord(token: string, object: CrmObject, id: string, properties: Record<string, string>) {
  return await hs<{ id: string; properties: Record<string, string | null> }>(token, `/crm/v3/objects/${object}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  })
}

export async function createNote(token: string, object: CrmObject, id: string, text: string) {
  return await hs<{ id: string }>(token, "/crm/v3/objects/notes", {
    method: "POST",
    body: JSON.stringify({
      properties: { hs_timestamp: new Date().toISOString(), hs_note_body: text },
      associations: [{ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: NOTE_ASSOC[object] }] }],
    }),
  })
}

export async function createTask(token: string, object: CrmObject, id: string, subject: string, text: string, due: string | null) {
  return await hs<{ id: string }>(token, "/crm/v3/objects/tasks", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        hs_timestamp: due ? new Date(due).toISOString() : new Date(Date.now() + 86_400_000).toISOString(),
        hs_task_subject: subject,
        hs_task_body: text,
        hs_task_status: "NOT_STARTED",
        hs_task_priority: "MEDIUM",
        hs_task_type: "TODO",
      },
      associations: [{ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: TASK_ASSOC[object] }] }],
    }),
  })
}

export type HubSpotConfig = { portal_id?: number | null; ui_domain?: string | null }

export async function hubspotToken(admin: SupabaseClient, workspaceId: string): Promise<{ token: string; config: HubSpotConfig } | null> {
  const [{ data }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "hubspot" }),
    admin.from("integrations").select("status, config").eq("workspace_id", workspaceId).eq("provider", "hubspot").maybeSingle(),
  ])
  const secret = data?.[0] as { refresh_token: string } | undefined
  if (!secret || !integ || integ.status !== "active") return null
  return { token: secret.refresh_token, config: (integ.config ?? {}) as HubSpotConfig }
}
