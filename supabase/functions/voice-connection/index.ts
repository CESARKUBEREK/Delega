// voice-connection: activa la atención telefónica con Grok Voice en un espacio.
// Solo owners y admins.
//   create      genera la clave del servidor MCP (la devuelve una sola vez) y
//               la guarda en Vault. Si ya había una, la sustituye.
//   settings    guarda el horario de citas, la duración y los documentos.
//   disconnect  borra la conexión: el agente de xAI deja de tener acceso.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { randomToken } from "../_shared/google.ts"
import { readVoiceConfig, VOICE_PROVIDER } from "../_shared/voice.ts"

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin, userId } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede gestionar la atención telefónica.")

  if (body?.action === "create") {
    const { data: current } = await admin.from("integrations").select("config").eq("workspace_id", workspaceId).eq("provider", VOICE_PROVIDER).maybeSingle()
    const token = `msv_${randomToken(32)}`
    const { error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: VOICE_PROVIDER,
      p_refresh_token: token,
      p_account_email: "Grok Voice",
      p_scopes: "",
      p_actor: userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo crear el acceso.")
    await admin.rpc("integration_set_config", { p_workspace_id: workspaceId, p_provider: VOICE_PROVIDER, p_config: readVoiceConfig(current?.config) })
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/voice-mcp?w=${workspaceId}`
    return json({ ok: true, url, token })
  }

  if (body?.action === "settings") {
    const { data: current } = await admin.from("integrations").select("id").eq("workspace_id", workspaceId).eq("provider", VOICE_PROVIDER).maybeSingle()
    if (!current) return fail(409, "not_connected", "Activa primero la atención telefónica.")
    const config = readVoiceConfig(body.config)
    // Solo archivos de Drive que ya son de este espacio.
    if (config.file_ids.length) {
      const { data: files } = await admin.from("integration_files").select("id").eq("workspace_id", workspaceId).in("id", config.file_ids)
      config.file_ids = (files ?? []).map((f) => f.id as string)
    }
    const { error } = await admin.rpc("integration_set_config", { p_workspace_id: workspaceId, p_provider: VOICE_PROVIDER, p_config: config })
    if (error) return fail(500, "save_failed", "No se pudieron guardar los ajustes.")
    return json({ ok: true, config })
  }

  if (body?.action === "disconnect") {
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: VOICE_PROVIDER, p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desactivar la atención telefónica.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
