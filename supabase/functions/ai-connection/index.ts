// ai-connection: conecta, cambia de modelo, marca como principal o desconecta
// la clave de un proveedor de IA (OpenAI, Anthropic, DeepSeek o Grok) de un espacio
// (BYOK). Solo owners y admins. La clave se valida contra el proveedor y se
// guarda cifrada en Vault; nunca se devuelve ni se registra.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { AI_MODELS, DEFAULT_MODELS, isProvider, type Provider, PROVIDER_LABEL } from "../_shared/llm.ts"

const KEY_RE: Record<Provider, RegExp> = {
  openai: /^sk-[A-Za-z0-9_-]{20,300}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,300}$/,
  deepseek: /^sk-[A-Za-z0-9_-]{20,300}$/,
  xai: /^xai-[A-Za-z0-9_-]{20,300}$/,
}
const KEY_HINT: Record<Provider, string> = {
  openai: "La clave no tiene el formato de una clave de OpenAI (empieza por sk-).",
  anthropic: "La clave no tiene el formato de una clave de Anthropic (empieza por sk-ant-).",
  deepseek: "La clave no tiene el formato de una clave de DeepSeek (empieza por sk-).",
  xai: "La clave no tiene el formato de una clave de xAI (empieza por xai-).",
}

// Validación con una llamada sin coste: listar los modelos disponibles.
function checkRequest(provider: Provider, apiKey: string): [string, Record<string, string>] {
  if (provider === "anthropic") return ["https://api.anthropic.com/v1/models", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }]
  if (provider === "deepseek") return ["https://api.deepseek.com/models", { Authorization: `Bearer ${apiKey}` }]
  if (provider === "xai") return ["https://api.x.ai/v1/models", { Authorization: `Bearer ${apiKey}` }]
  return ["https://api.openai.com/v1/models", { Authorization: `Bearer ${apiKey}` }]
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")

  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  const action = body?.action
  const provider: Provider = isProvider(body?.provider) ? body.provider : "openai"
  const label = PROVIDER_LABEL[provider]
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")

  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") {
    return fail(403, "forbidden", "Solo un administrador puede gestionar las claves de este espacio.")
  }

  const model = typeof body?.model === "string" && AI_MODELS[provider].includes(body.model) ? body.model : DEFAULT_MODELS[provider]

  if (action === "save") {
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : ""
    if (!KEY_RE[provider].test(apiKey)) return fail(400, "invalid_format", KEY_HINT[provider])

    const [url, headers] = checkRequest(provider, apiKey)
    let check: Response
    try {
      check = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
    } catch {
      return fail(502, "provider_unreachable", `No se pudo contactar con ${label}. Inténtalo de nuevo.`)
    }
    await check.body?.cancel()
    if (check.status === 401) return fail(400, "invalid_key", `${label} ha rechazado la clave. Revisa que esté copiada entera y activa.`)
    if (check.status === 403) return fail(400, "forbidden_key", `La clave no tiene permiso para usar la API. Revisa sus permisos en ${label}.`)
    if (!check.ok) return fail(502, "provider_error", `${label} no respondió correctamente. Inténtalo en unos minutos.`)

    const { data, error } = await ctx.admin.rpc("ai_connection_save", {
      p_workspace_id: workspaceId,
      p_provider: provider,
      p_api_key: apiKey,
      p_model: model,
      p_actor: ctx.userId,
    })
    if (error || !data?.[0]) return fail(500, "save_failed", "No se pudo guardar la clave.")
    return json({ ok: true, key_hint: data[0].key_hint, model: data[0].model })
  }

  if (action === "set_model") {
    const { data, error } = await ctx.admin
      .from("ai_connections")
      .update({ model })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .select("model")
    if (error || !data?.length) return fail(404, "no_connection", `Primero conecta una clave de ${label}.`)
    return json({ ok: true, model })
  }

  if (action === "set_default") {
    const { data, error } = await ctx.admin.rpc("ai_connection_set_default", { p_workspace_id: workspaceId, p_provider: provider })
    if (error || !data) return fail(404, "no_connection", `Primero conecta una clave de ${label}.`)
    return json({ ok: true })
  }

  if (action === "delete") {
    const { error } = await ctx.admin.rpc("ai_connection_delete", {
      p_workspace_id: workspaceId,
      p_provider: provider,
      p_actor: ctx.userId,
    })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar la clave.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
