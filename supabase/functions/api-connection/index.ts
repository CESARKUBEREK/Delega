// Guarda las credenciales de Supabase y de las dos APIs personalizadas en Vault.
// Solo owners/admins pueden conectarlas o desconectarlas.
import { authenticate, fail, isUuid, json, membershipRole, type AuthContext } from "../_shared/core.ts"

const PROVIDERS = new Set(["supabase", "custom_1", "custom_2"])
const HEADER_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,80}$/

function baseUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null
  try {
    const url = new URL(value.trim())
    const host = url.hostname.toLowerCase()
    if (
      url.protocol !== "https:" || !host || url.username || url.password || url.search || url.hash ||
      host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") ||
      host.endsWith(".test") || host.endsWith(".invalid") || host === "metadata.google.internal" ||
      host.startsWith("[") || /^\d+(?:\.\d+){3}$/.test(host)
    ) return null
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`
  } catch {
    return null
  }
}

// Parte central de un JWT (las claves anon y service_role antiguas lo son), para detectar claves secretas.
function jwtPayload(key: string): string {
  const part = key.split(".")[1]
  if (!part) return ""
  try {
    return atob(part.replace(/-/g, "+").replace(/_/g, "/"))
  } catch {
    return ""
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

async function save(ctx: AuthContext, body: Record<string, unknown>) {
  // Type narrowing is handled at the call site; this guard keeps secrets in Vault only.
  const workspaceId = body.workspace_id
  const provider = body.provider
  if (!isUuid(workspaceId) || typeof provider !== "string" || !PROVIDERS.has(provider)) {
    return fail(400, "bad_request", "Espacio o integración no válidos.")
  }

  if (provider === "supabase") {
    // Se admite la URL tal cual se copia (con /rest/v1 o una barra al final).
    const projectUrl = baseUrl(typeof body.project_url === "string" ? body.project_url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "") : "")
    const anonKey = text(body.anon_key, 1000)
    if (!projectUrl || !anonKey || anonKey.length < 10) {
      return fail(400, "invalid_format", "Revisa la URL del proyecto (https://….supabase.co) y la clave publishable o anon.")
    }
    if (anonKey.startsWith("sb_secret_") || /"role"\s*:\s*"service_role"/.test(jwtPayload(anonKey))) {
      return fail(400, "secret_key", "Esa es una clave secreta: no la pegues aquí. Usa la clave publishable (sb_publishable_…) o la anon.")
    }
    // Supabase ya no deja leer la raíz de la Data API (/rest/v1/) con claves
    // públicas (desde 2026). Se comprueba la URL y la clave con /auth/v1/settings,
    // que es público y responde 401 si la clave no es de ese proyecto.
    try {
      const response = await fetch(`${projectUrl}/auth/v1/settings`, {
        headers: { apikey: anonKey, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      })
      if (response.status === 401 || response.status === 403) {
        return fail(400, "invalid_key", "Supabase no reconoce la clave. Copia la clave publishable (o la anon) de Project Settings → API Keys de ese proyecto.")
      }
      if (!response.ok) return fail(400, "connection_failed", "No se encontró el proyecto de Supabase en esa URL. Cópiala de Project Settings → Data API (https://….supabase.co).")
    } catch {
      return fail(400, "connection_failed", "No se pudo contactar con el proyecto. Revisa la URL (https://….supabase.co) y que el proyecto no esté en pausa.")
    }
    const { error } = await ctx.admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: provider,
      p_refresh_token: JSON.stringify({ anon_key: anonKey }),
      p_account_email: "Proyecto Supabase",
      p_scopes: "",
      p_actor: ctx.userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    await ctx.admin.rpc("integration_set_config", { p_workspace_id: workspaceId, p_provider: provider, p_config: { project_url: projectUrl } })
    return json({ ok: true })
  }

  const name = text(body.name, 60)
  const url = baseUrl(body.base_url)
  const authType = body.auth_type === "bearer" || body.auth_type === "header" ? body.auth_type : "none"
  const headerName = text(body.header_name, 80)
  const token = text(body.token, 1500)
  if (!name || !url) return fail(400, "invalid_format", "Indica un nombre y una URL base HTTPS válida.")
  if (authType !== "none" && token.length < 1) return fail(400, "invalid_format", "Añade el token o la clave API.")
  if (authType === "header" && (!HEADER_RE.test(headerName) || ["authorization", "host", "cookie", "content-length"].includes(headerName.toLowerCase()))) {
    return fail(400, "invalid_format", "El nombre de la cabecera API no es válido.")
  }

  const secret = JSON.stringify({ auth_type: authType, header_name: authType === "header" ? headerName : "", token })
  const { error } = await ctx.admin.rpc("integration_save", {
    p_workspace_id: workspaceId,
    p_provider: provider,
    p_refresh_token: secret,
    p_account_email: name,
    p_scopes: "",
    p_actor: ctx.userId,
  })
  if (error) return fail(500, "save_failed", "No se pudo guardar la conexión.")
  await ctx.admin.rpc("integration_set_config", {
    p_workspace_id: workspaceId,
    p_provider: provider,
    p_config: { name, base_url: url, auth_type: authType, header_name: authType === "header" ? headerName : "" },
  })
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  const provider = body?.provider
  if (!isUuid(workspaceId) || typeof provider !== "string" || !PROVIDERS.has(provider)) {
    return fail(400, "bad_request", "Espacio o integración no válidos.")
  }
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede gestionar estas conexiones.")

  if (body?.action === "save") return await save(ctx, body)
  if (body?.action === "disconnect") {
    const { error } = await ctx.admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: provider, p_actor: ctx.userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar la integración.")
    return json({ ok: true })
  }
  return fail(400, "bad_request", "Acción no válida.")
})
