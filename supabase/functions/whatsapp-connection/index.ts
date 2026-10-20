// whatsapp-connection: conecta la cuenta de WhatsApp Business (Cloud API de
// Meta) de un espacio. Solo owners y admins. Las credenciales se guardan
// juntas y cifradas en Vault; nunca se devuelven al navegador.
// Acciones: save, webhook_info, disconnect.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { randomToken } from "../_shared/google.ts"
import { parseSecret, phoneInfo, WhatsAppError } from "../_shared/whatsapp.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!

function webhookUrl(integrationId: string) {
  return `${SUPABASE_URL}/functions/v1/whatsapp-webhook?c=${integrationId}`
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") {
    return fail(403, "forbidden", "Solo un administrador puede gestionar WhatsApp en este espacio.")
  }

  if (body?.action === "save") {
    const phoneNumberId = typeof body.phone_number_id === "string" ? body.phone_number_id.trim() : ""
    const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : ""
    const appSecret = typeof body.app_secret === "string" ? body.app_secret.trim() : ""
    if (!/^[0-9]{5,30}$/.test(phoneNumberId)) return fail(400, "invalid_phone_id", "El identificador del número son solo cifras (Phone number ID).")
    if (!/^[A-Za-z0-9_-]{20,1000}$/.test(accessToken)) return fail(400, "invalid_token", "El token de acceso no tiene un formato válido.")
    if (!/^[A-Za-z0-9]{16,128}$/.test(appSecret)) return fail(400, "invalid_app_secret", "El secreto de la app no tiene un formato válido.")

    let info
    try {
      info = await phoneInfo(accessToken, phoneNumberId)
    } catch (e) {
      return fail(400, "meta_rejected", e instanceof WhatsAppError ? e.message : "Meta no aceptó estos datos.")
    }

    const verifyToken = randomToken(24)
    const secret = JSON.stringify({ access_token: accessToken, app_secret: appSecret, verify_token: verifyToken })
    const display = info.display_phone_number ?? null
    const { data: integrationId, error } = await ctx.admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "whatsapp",
      p_refresh_token: secret,
      p_account_email: display,
      p_scopes: "",
      p_actor: ctx.userId,
    })
    if (error || !integrationId) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    await ctx.admin.rpc("integration_set_config", {
      p_workspace_id: workspaceId,
      p_provider: "whatsapp",
      p_config: { phone_number_id: phoneNumberId, display_phone_number: display, verified_name: info.verified_name ?? null },
    })
    return json({ ok: true, display_phone_number: display, webhook_url: webhookUrl(integrationId as string), verify_token: verifyToken })
  }

  if (body?.action === "webhook_info") {
    const { data: integ } = await ctx.admin
      .from("integrations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "whatsapp")
      .maybeSingle()
    if (!integ) return fail(404, "no_connection", "WhatsApp no está conectado.")
    const { data } = await ctx.admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "whatsapp" })
    const secret = parseSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
    if (!secret) return fail(500, "corrupt", "La conexión está incompleta. Vuelve a conectarla.")
    return json({ webhook_url: webhookUrl(integ.id), verify_token: secret.verify_token })
  }

  if (body?.action === "disconnect") {
    const { error } = await ctx.admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "whatsapp", p_actor: ctx.userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar WhatsApp.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
