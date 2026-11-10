// mcp: servidor MCP de MarchaSolo para los asistentes de cada persona (Claude,
// ChatGPT, Grok Bot…). Fase 11-1, spec claude/spec-fase-11-servidor-mcp.md.
//
//   URL pública:  https://www.marchasolo.com/mcp  (reescritura de Vercel hacia
//                 …/functions/v1/mcp; MCP_RESOURCE_URL si cambia)
//   Metadatos:    /.well-known/oauth-protected-resource[/mcp] (RFC 9728), que
//                 apuntan al servidor OAuth 2.1 de Supabase Auth (MCP_AUTH_ISSUER).
//
// Autenticación (siempre en la cabecera Authorization: Bearer, nunca en la URL):
// - token OAuth de Supabase Auth con claim client_id → la conexión que la
//   persona aprobó en /oauth/consent para ese cliente;
// - clave ms_live_… creada en Ajustes → Conexiones de asistentes.
// Sin credencial válida: 401 con WWW-Authenticate (así el cliente descubre OAuth).
//
// Transporte Streamable HTTP sin estado, respuestas JSON (como voice-mcp).
// Métodos: initialize, ping, tools/list, tools/call. Sin JWT de Supabase en la
// pasarela (--no-verify-jwt): la función valida el token ella misma.
import { createClient } from "npm:@supabase/supabase-js@2.118.0"
import { API_KEY_RE, bearer, callTool, keyInUrl, type McpConnection, McpToolError, SERVER_INSTRUCTIONS, sha256Hex, toolScope, toolsFor } from "../_shared/mcp.ts"

function secretKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS")
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      if (parsed.default) return parsed.default
    } catch {
      // variable heredada
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const admin = createClient(SUPABASE_URL, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } })

const RESOURCE = (Deno.env.get("MCP_RESOURCE_URL") ?? "https://www.marchasolo.com/mcp").replace(/\/$/, "")
const RESOURCE_URL = new URL(RESOURCE)
const ISSUER = (Deno.env.get("MCP_AUTH_ISSUER") ?? `${SUPABASE_URL}/auth/v1`).replace(/\/$/, "")
const APP_URL = RESOURCE_URL.origin
const METADATA_URL = `${RESOURCE_URL.origin}/.well-known/oauth-protected-resource${RESOURCE_URL.pathname === "/" ? "" : RESOURCE_URL.pathname}`

const SERVER = { name: "MarchaSolo", title: "MarchaSolo", version: "1.0.0", websiteUrl: APP_URL }
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const send = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  })
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } })

function unauthorized(message: string, invalidToken = false) {
  const challenge = `Bearer resource_metadata="${METADATA_URL}"${invalidToken ? `, error="invalid_token", error_description="${message}"` : ""}`
  return send(rpcError(null, -32001, message), 401, { "WWW-Authenticate": challenge })
}

function protectedResourceMetadata() {
  return send(
    {
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      bearer_methods_supported: ["header"],
      resource_name: "MarchaSolo",
      resource_documentation: `${APP_URL}/integraciones`,
    },
    200,
    { "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*" },
  )
}

// La conexión de quien llama, o una respuesta 401.
async function resolveConnection(req: Request): Promise<McpConnection | Response> {
  const token = bearer(req)
  if (!token) return unauthorized("Conecta tu asistente con MarchaSolo.")
  let params: { p_key_hash: string | null; p_user_id: string | null; p_client_id: string | null }
  if (API_KEY_RE.test(token)) {
    params = { p_key_hash: await sha256Hex(token), p_user_id: null, p_client_id: null }
  } else {
    // Token OAuth emitido por Supabase Auth a un asistente (lleva client_id).
    const { data, error } = await admin.auth.getClaims(token)
    const claims = data?.claims as { sub?: string; client_id?: string; iss?: string } | undefined
    if (error || !claims?.sub) return unauthorized("La sesión del asistente no es válida o caducó.", true)
    if (!claims.client_id) return unauthorized("Este token no es de un asistente conectado.", true)
    if (claims.iss && claims.iss.replace(/\/$/, "") !== ISSUER) return unauthorized("Token de otro emisor.", true)
    params = { p_key_hash: null, p_user_id: claims.sub, p_client_id: claims.client_id }
  }
  const { data: rows, error } = await admin.rpc("mcp_resolve", params)
  if (error) {
    console.error("mcp resolve", error.code)
    return send(rpcError(null, -32603, "No se pudo comprobar la conexión."), 500)
  }
  const conn = (rows?.[0] ?? null) as McpConnection | null
  if (!conn) return unauthorized("Esta conexión no existe, se revocó o caducó. Vuelve a conectar MarchaSolo.", true)
  return conn
}

async function logCall(conn: McpConnection, tool: string, ok: boolean, code: string | null) {
  const { error } = await admin.from("mcp_calls").insert({ connection_id: conn.id, workspace_id: conn.workspace_id, tool: tool.slice(0, 60), ok, error_code: code })
  if (error) console.error("mcp log", error.code)
  // De vez en cuando, limpia el registro (90 días).
  if (Math.random() < 0.01) await admin.rpc("mcp_calls_purge").then(() => {}, () => {})
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (url.pathname.includes("/.well-known/oauth-protected-resource")) {
    if (req.method === "GET" || req.method === "HEAD") return protectedResourceMetadata()
    return new Response(null, { status: 405, headers: { Allow: "GET" } })
  }
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS" } })
  // Sin flujo SSE del servidor: solo POST (permitido por la especificación).
  if (req.method === "GET" || req.method === "DELETE" || req.method === "HEAD") return new Response(null, { status: 405, headers: { Allow: "POST" } })
  if (req.method !== "POST") return new Response(null, { status: 405 })
  if (keyInUrl(url)) return unauthorized("La clave va en la cabecera Authorization, nunca en la URL.", true)

  const conn = await resolveConnection(req)
  if (conn instanceof Response) return conn

  const payload = await req.json().catch(() => null)
  if (!payload) return send(rpcError(null, -32700, "JSON no válido."), 400)
  const batch = Array.isArray(payload)
  const requests = (batch ? payload : [payload]).slice(0, 20) as RpcRequest[]

  const answers: unknown[] = []
  for (const r of requests) {
    if (r.id === undefined || r.id === null) continue // notificaciones
    const id = r.id
    switch (r.method) {
      case "initialize": {
        const asked = typeof r.params?.protocolVersion === "string" ? r.params.protocolVersion : ""
        answers.push({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER,
            instructions: SERVER_INSTRUCTIONS,
          },
        })
        break
      }
      case "ping":
        answers.push({ jsonrpc: "2.0", id, result: {} })
        break
      case "tools/list":
        answers.push({ jsonrpc: "2.0", id, result: { tools: toolsFor(conn.scopes) } })
        break
      case "tools/call": {
        const name = typeof r.params?.name === "string" ? r.params.name : ""
        const args = r.params?.arguments && typeof r.params.arguments === "object" ? (r.params.arguments as Record<string, unknown>) : {}
        const scope = toolScope(name)
        if (!scope) {
          answers.push(rpcError(id, -32602, "Herramienta desconocida."))
          break
        }
        const { data: rate } = await admin.rpc("mcp_check_rate", { p_connection_id: conn.id })
        if (rate) {
          const daily = rate === "rate_day"
          await logCall(conn, name, false, String(rate))
          return send(
            rpcError(id, -32029, daily ? "Has llegado al límite de hoy de MarchaSolo. Vuelve a intentarlo mañana." : "Demasiadas llamadas seguidas. Espera un minuto."),
            429,
            { "Retry-After": daily ? "3600" : "60" },
          )
        }
        if (!conn.scopes.includes(scope)) {
          await logCall(conn, name, false, "sin_permiso")
          answers.push({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: JSON.stringify({ error: "sin_permiso", mensaje: "Esta conexión no tiene permiso para esa herramienta. La persona puede cambiarlo al volver a conectar MarchaSolo." }) }], isError: true },
          })
          break
        }
        try {
          const out = await callTool({ admin, conn, appUrl: APP_URL }, name, args)
          await logCall(conn, name, true, null)
          answers.push({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out, isError: false } })
        } catch (e) {
          const code = e instanceof McpToolError ? e.code : "internal"
          const message = e instanceof McpToolError ? e.message : "No se pudo completar. Inténtalo de nuevo."
          if (!(e instanceof McpToolError)) console.error("mcp", name, e instanceof Error ? e.name : "error")
          await logCall(conn, name, false, code)
          answers.push({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: code, mensaje: message }) }], isError: true } })
        }
        break
      }
      default:
        answers.push(rpcError(id, -32601, "Método no disponible."))
    }
  }

  if (!answers.length) return send(null, 202)
  return send(batch ? answers : answers[0])
})
