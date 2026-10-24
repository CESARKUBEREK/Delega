// Cliente mínimo de la API de Xubio (1.1), solo lectura. Las credenciales
// (Client ID y Secret ID de «Configuración → Integraciones → API de Xubio»)
// viven en Vault como JSON y nunca se registran.
//
// Autenticación OAuth2 client_credentials: POST TokenEndpoint con Basic auth;
// el token dura 1 hora y se pide al empezar cada uso.
//
// No se crean comprobantes: una factura en Xubio es un documento fiscal (AFIP/
// ARCA) que no se puede deshacer. La escritura queda pendiente de decidir.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

const API = "https://xubio.com/API/1.1"
const MAX_ITEMS = 100

export class XubioError extends Error {
  constructor(public code: "invalid_credentials" | "plan" | "not_found" | "bad_request" | "unavailable", message: string) {
    super(message)
  }
}

export type XubioCredentials = { client_id: string; secret_id: string }

export const XUBIO_ID_RE = /^[A-Za-z0-9._-]{8,200}$/

// Recursos de lectura que ve el agente → recurso de la API.
export const XUBIO_RESOURCES = {
  clientes: "clienteBean",
  proveedores: "proveedorBean",
  productos: "productoVentaBean",
  facturas_venta: "comprobanteVentaBean",
  facturas_compra: "comprobanteCompraBean",
} as const
export type XubioResource = keyof typeof XUBIO_RESOURCES
const DATED = new Set<XubioResource>(["facturas_venta", "facturas_compra"])

export function parseXubioSecret(raw: string | null | undefined): XubioCredentials | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as Partial<XubioCredentials>
    return typeof v.client_id === "string" && typeof v.secret_id === "string" ? { client_id: v.client_id, secret_id: v.secret_id } : null
  } catch {
    return null
  }
}

export async function xubioToken(c: XubioCredentials): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${API}/TokenEndpoint`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${c.client_id}:${c.secret_id}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new XubioError("unavailable", "Xubio no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!res.ok || !data.access_token) {
    if (res.status === 400 || res.status === 401 || data.error === "invalid_client") {
      throw new XubioError("invalid_credentials", "Xubio no reconoce el Client ID o el Secret ID.")
    }
    throw new XubioError("unavailable", `Error de Xubio al pedir acceso (${res.status}).`)
  }
  return data.access_token
}

async function xb<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${API}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res: Response
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) })
  } catch {
    throw new XubioError("unavailable", "Xubio no respondió a tiempo.")
  }
  if (!res.ok) {
    await res.body?.cancel()
    if (res.status === 401) throw new XubioError("invalid_credentials", "Xubio rechazó el acceso (token caducado o credenciales no válidas).")
    if (res.status === 403) throw new XubioError("plan", "Tu plan de Xubio no incluye este recurso de la API.")
    if (res.status === 404) throw new XubioError("not_found", "Xubio no encontró ese registro.")
    if (res.status === 400) throw new XubioError("bad_request", "Xubio rechazó la consulta.")
    throw new XubioError("unavailable", `Error de Xubio (${res.status}).`)
  }
  return (await res.json().catch(() => null)) as T
}

// Comprueba las credenciales: token y lectura de clientes.
export async function checkXubio(c: XubioCredentials): Promise<{ clients: number }> {
  const token = await xubioToken(c)
  const list = await xb<unknown>(token, XUBIO_RESOURCES.clientes)
  return { clients: Array.isArray(list) ? list.length : 0 }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Lista un recurso. Los comprobantes admiten un rango de fechas.
export async function xubioList(
  token: string,
  resource: XubioResource,
  opts: { date_from?: string | null; date_to?: string | null; limit?: number | null },
): Promise<{ resource: XubioResource; count: number; items: unknown[]; truncated: boolean }> {
  const params: Record<string, string> = {}
  if (DATED.has(resource)) {
    if (opts.date_from && DATE_RE.test(opts.date_from)) params.fechaDesde = opts.date_from
    if (opts.date_to && DATE_RE.test(opts.date_to)) params.fechaHasta = opts.date_to
  }
  const data = await xb<unknown>(token, XUBIO_RESOURCES[resource], params)
  const list = Array.isArray(data) ? data : []
  const limit = Math.min(Math.max(1, opts.limit ?? 30), MAX_ITEMS)
  return { resource, count: list.length, items: list.slice(0, limit), truncated: list.length > limit }
}

export async function xubioGet(token: string, resource: XubioResource, id: string): Promise<unknown> {
  if (!/^[0-9]{1,20}$/.test(id)) throw new XubioError("bad_request", "Identificador no válido.")
  return await xb<unknown>(token, `${XUBIO_RESOURCES[resource]}/${id}`)
}

export async function xubioCredentials(admin: SupabaseClient, workspaceId: string): Promise<XubioCredentials | null> {
  const [{ data }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "xubio" }),
    admin.from("integrations").select("status").eq("workspace_id", workspaceId).eq("provider", "xubio").maybeSingle(),
  ])
  const creds = parseXubioSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
  return creds && integ?.status === "active" ? creds : null
}
