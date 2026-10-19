// ai-connection: conecta, cambia de modelo o desconecta la clave de OpenAI
// de un espacio (BYOK). Solo owners y admins. La clave se valida contra
// OpenAI y se guarda cifrada en Vault; nunca se devuelve ni se registra.
import { authenticate, DEFAULT_MODEL, fail, isUuid, json, membershipRole, OPENAI_MODELS } from "../_shared/core.ts"

const KEY_RE = /^sk-[A-Za-z0-9_-]{20,300}$/

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")

  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  const action = body?.action
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")

  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") {
    return fail(403, "forbidden", "Solo un administrador puede gestionar las claves de este espacio.")
  }

  const model = typeof body?.model === "string" && (OPENAI_MODELS as readonly string[]).includes(body.model)
    ? body.model
    : DEFAULT_MODEL

  if (action === "save") {
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : ""
    if (!KEY_RE.test(apiKey)) {
      return fail(400, "invalid_format", "La clave no tiene el formato de una clave de OpenAI (empieza por sk-).")
    }

    // Validación con una llamada sin coste: listar modelos.
    let check: Response
    try {
      check = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      return fail(502, "provider_unreachable", "No se pudo contactar con OpenAI. Inténtalo de nuevo.")
    }
    if (check.status === 401) return fail(400, "invalid_key", "OpenAI ha rechazado la clave. Revisa que esté copiada entera y activa.")
    if (check.status === 403) return fail(400, "forbidden_key", "La clave no tiene permiso para usar la API. Revisa sus permisos en OpenAI.")
    if (!check.ok) return fail(502, "provider_error", "OpenAI no respondió correctamente. Inténtalo en unos minutos.")
    await check.body?.cancel()

    const { data, error } = await ctx.admin.rpc("ai_connection_save", {
      p_workspace_id: workspaceId,
      p_provider: "openai",
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
      .eq("provider", "openai")
      .select("model")
    if (error || !data?.length) return fail(404, "no_connection", "Primero conecta una clave de OpenAI.")
    return json({ ok: true, model })
  }

  if (action === "delete") {
    const { error } = await ctx.admin.rpc("ai_connection_delete", {
      p_workspace_id: workspaceId,
      p_provider: "openai",
      p_actor: ctx.userId,
    })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar la clave.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
