// Peticiones REST limitadas a conexiones activas guardadas en Vault.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

type Provider = "supabase" | "custom_1" | "custom_2"
type Method = "GET" | "POST" | "PATCH" | "DELETE"

function publicHttps(value: string): URL {
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  if (
    url.protocol !== "https:" || url.username || url.password ||
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".invalid") ||
    host === "metadata.google.internal" || host.startsWith("[") || /^\d+(?:\.\d+){3}$/.test(host)
  ) throw new Error("La conexión REST requiere un dominio HTTPS público.")
  return url
}

export async function apiRequest(
  admin: SupabaseClient,
  workspaceId: string,
  provider: Provider,
  method: Method,
  path: string,
  query: string,
  body: string,
): Promise<{ status: number; body: unknown }> {
  const { data: rows } = await admin.from("integrations")
    .select("status, config").eq("workspace_id", workspaceId).eq("provider", provider).maybeSingle()
  if (rows?.status !== "active") throw new Error("La conexión API no está activa. Revísala en Integraciones.")
  const config = rows.config && typeof rows.config === "object" ? rows.config as Record<string, unknown> : {}
  const { data: secrets } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: provider })
  const raw = (secrets?.[0] as { refresh_token?: string } | undefined)?.refresh_token
  let secret: Record<string, unknown> = {}
  try { secret = JSON.parse(raw || "{}") as Record<string, unknown> } catch { throw new Error("No se pudo leer la credencial API.") }

  let base: URL
  let target: URL
  const headers = new Headers({ Accept: "application/json" })
  if (provider === "supabase") {
    const projectUrl = typeof config.project_url === "string" ? config.project_url : ""
    const anonKey = typeof secret.anon_key === "string" ? secret.anon_key : ""
    base = publicHttps(projectUrl)
    if (!base.hostname.endsWith(".supabase.co") || !anonKey) throw new Error("La conexión Supabase no está configurada correctamente.")
    const table = path.trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(table)) throw new Error("Indica una tabla válida de Supabase.")
    target = new URL(`${base.origin}/rest/v1/${table}`)
    headers.set("apikey", anonKey)
    headers.set("Prefer", "return=representation")
  } else {
    const baseValue = typeof config.base_url === "string" ? config.base_url : ""
    base = publicHttps(baseValue)
    const relative = path.trim()
    if (!relative || relative.startsWith("/") || relative.includes("\\") || relative.split("/").some((part) => part === "." || part === "..") || /^[a-z][a-z0-9+.-]*:/i.test(relative)) {
      throw new Error("La ruta debe ser relativa a la URL base configurada.")
    }
    target = new URL(relative, base.href.endsWith("/") ? base : new URL(base.href + "/"))
    if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname.replace(/\/$/, "") + "/") && target.pathname !== base.pathname) {
      throw new Error("La ruta queda fuera de la URL base de la integración.")
    }
    const authType = secret.auth_type
    const token = typeof secret.token === "string" ? secret.token : ""
    if (authType === "bearer" && token) headers.set("Authorization", `Bearer ${token}`)
    if (authType === "header" && token) {
      const headerName = typeof secret.header_name === "string" ? secret.header_name : ""
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,80}$/.test(headerName) || ["authorization","host","cookie","content-length"].includes(headerName.toLowerCase())) throw new Error("La cabecera de autenticación no es válida.")
      headers.set(headerName, token)
    }
  }
  if (query.length > 1200 || query.includes("#")) throw new Error("La consulta API es demasiado larga o no válida.")
  if (query) {
    const qs = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query)
    qs.forEach((value, key) => target.searchParams.set(key, value))
  }
  if (method !== "GET") {
    if (body.length > 30_000) throw new Error("El cuerpo de la petición supera el límite de 30 KB.")
    if (body) {
      try { JSON.parse(body) } catch { throw new Error("El cuerpo debe ser JSON válido.") }
      headers.set("Content-Type", "application/json")
    }
  }
  const response = await fetch(target, {
    method,
    headers,
    ...(method !== "GET" && body ? { body } : {}),
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  })
  const text = (await response.text()).slice(0, 16_000)
  let result: unknown = text
  try { result = text ? JSON.parse(text) : null } catch { /* Respuesta de texto */ }
  return { status: response.status, body: result }
}
