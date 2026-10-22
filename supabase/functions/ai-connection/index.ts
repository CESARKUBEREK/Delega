// ai-connection: gestiona las claves de IA de un espacio (BYOK) para OpenAI,
// Anthropic, DeepSeek y Kimi. Solo owners y admins.
//   save         valida la clave con el proveedor y la guarda cifrada en Vault.
//   set_model    cambia el modelo de un proveedor.
//   set_default  elige el proveedor que usa el espacio.
//   delete       desconecta un proveedor.
// La clave nunca se devuelve ni se registra.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { isProvider, LLMError, PROVIDERS, validateKey } from "../_shared/llm.ts"

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

  // Antes solo había OpenAI: sin proveedor se entiende OpenAI.
  const provider = body?.provider === undefined ? "openai" : body.provider
  if (!isProvider(provider)) return fail(400, "bad_request", "Proveedor no válido.")
  const info = PROVIDERS[provider]
  const model = typeof body?.model === "string" && info.models.includes(body.model) ? body.model : info.models[0]

  if (action === "save") {
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : ""
    if (!info.keyRe.test(apiKey)) {
      return fail(400, "invalid_format", `La clave no tiene el formato de una clave de ${info.label} (${info.keyHint}).`)
    }
    try {
      await validateKey(provider, apiKey)
    } catch (e) {
      const msg = e instanceof LLMError ? e.message : `No se pudo comprobar la clave con ${info.label}.`
      return fail(e instanceof LLMError && e.code === "invalid_key" ? 400 : 502, "invalid_key", msg)
    }

    const { data, error } = await ctx.admin.rpc("ai_connection_save", {
      p_workspace_id: workspaceId,
      p_provider: provider,
      p_api_key: apiKey,
      p_model: model,
      p_actor: ctx.userId,
    })
    if (error || !data?.[0]) return fail(500, "save_failed", "No se pudo guardar la clave.")
    // La primera conexión del espacio pasa a ser la de por defecto.
    const { data: current } = await ctx.admin.rpc("ai_connection_ensure_default", { p_workspace_id: workspaceId })
    return json({ ok: true, key_hint: data[0].key_hint, model: data[0].model, is_default: current === provider })
  }

  if (action === "set_model") {
    const { data, error } = await ctx.admin
      .from("ai_connections")
      .update({ model })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .select("model")
    if (error || !data?.length) return fail(404, "no_connection", `Primero conecta una clave de ${info.label}.`)
    return json({ ok: true, model })
  }

  if (action === "set_default") {
    const { data, error } = await ctx.admin.rpc("ai_connection_set_default", {
      p_workspace_id: workspaceId,
      p_provider: provider,
      p_actor: ctx.userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo cambiar el proveedor.")
    if (!data) return fail(404, "no_connection", `Primero conecta una clave de ${info.label}.`)
    return json({ ok: true })
  }

  if (action === "delete") {
    const { error } = await ctx.admin.rpc("ai_connection_delete", {
      p_workspace_id: workspaceId,
      p_provider: provider,
      p_actor: ctx.userId,
    })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar la clave.")
    // Si era el de por defecto, otro proveedor conectado ocupa su lugar.
    const { data: next } = await ctx.admin.rpc("ai_connection_ensure_default", { p_workspace_id: workspaceId })
    return json({ ok: true, default_provider: typeof next === "string" ? next : null })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
