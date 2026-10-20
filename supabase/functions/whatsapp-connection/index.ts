// whatsapp-connection: conecta WhatsApp Business a un espacio. Solo owners y admins.
// Acciones:
//   embedded     alta con Embedded Signup en la app de Delega; con coexistencia
//                (número de la app WhatsApp Business) pide contactos e histórico.
//   save         alta manual con una app de Meta propia del espacio.
//   settings     categorías de clasificación y días de conservación.
//   webhook_info datos del webhook para el modo manual.
//   disconnect   borra la conexión y sus credenciales.
// Las credenciales se guardan cifradas en Vault y nunca vuelven al navegador.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { randomToken } from "../_shared/google.ts"
import {
  DEFAULT_CATEGORIES,
  exchangeSignupCode,
  GRAPH,
  listPhoneNumbers,
  parseSecret,
  phoneInfo,
  requestSync,
  subscribeApp,
  type WhatsAppConfig,
  WhatsAppError,
} from "../_shared/whatsapp.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!

function webhookUrl(integrationId: string) {
  return `${SUPABASE_URL}/functions/v1/whatsapp-webhook?c=${integrationId}`
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin, userId } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") {
    return fail(403, "forbidden", "Solo un administrador puede gestionar WhatsApp en este espacio.")
  }

  async function currentConfig(): Promise<WhatsAppConfig | null> {
    const { data } = await admin.from("integrations").select("config").eq("workspace_id", workspaceId).eq("provider", "whatsapp").maybeSingle()
    return (data?.config as WhatsAppConfig | undefined) ?? null
  }

  async function store(secret: object, display: string | null, config: WhatsAppConfig): Promise<string | Response> {
    const previous = await currentConfig()
    const { data: integrationId, error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "whatsapp",
      p_refresh_token: JSON.stringify(secret),
      p_account_email: display,
      p_scopes: "",
      p_actor: userId,
    })
    if (error || !integrationId) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    const { error: cfgError } = await admin.rpc("integration_set_config", {
      p_workspace_id: workspaceId,
      p_provider: "whatsapp",
      p_config: {
        categories: previous?.categories ?? DEFAULT_CATEGORIES,
        retention_days: previous?.retention_days ?? null,
        ...config,
      },
    })
    if (cfgError) {
      return fail(409, "number_in_use", "Ese número de WhatsApp ya está conectado a otro espacio de Delega.")
    }
    return integrationId as string
  }

  // ---------------------------------------------------------------------------
  if (body?.action === "embedded") {
    const code = typeof body.code === "string" ? body.code : ""
    const wabaId = typeof body.waba_id === "string" ? body.waba_id : ""
    const wantedPhone = typeof body.phone_number_id === "string" ? body.phone_number_id : ""
    const coexistence = body.coexistence === true
    if (!code || code.length > 2000 || !/^[0-9]{5,30}$/.test(wabaId)) return fail(400, "bad_request", "Respuesta de Meta incompleta.")

    try {
      const token = await exchangeSignupCode(code)
      const numbers = await listPhoneNumbers(token, wabaId)
      const phone = numbers.find((n) => n.id === wantedPhone) ?? numbers[0]
      if (!phone) return fail(400, "no_number", "La cuenta de WhatsApp Business no tiene ningún número.")
      await subscribeApp(token, wabaId)

      const result = await store({ access_token: token, mode: "embedded" }, phone.display_phone_number ?? null, {
        phone_number_id: phone.id,
        waba_id: wabaId,
        display_phone_number: phone.display_phone_number ?? null,
        verified_name: phone.verified_name ?? null,
        mode: "embedded",
        coexistence: coexistence || phone.is_on_biz_app === true,
      })
      if (result instanceof Response) return result

      // Coexistencia: contactos primero y luego el histórico (hay 24 h para pedirlo).
      let syncRequested = false
      if (coexistence || phone.is_on_biz_app) {
        try {
          await requestSync(token, phone.id, "smb_app_state_sync")
          await requestSync(token, phone.id, "history")
          syncRequested = true
        } catch {
          syncRequested = false
        }
      }
      return json({ ok: true, display_phone_number: phone.display_phone_number ?? null, sync_requested: syncRequested })
    } catch (e) {
      return fail(400, e instanceof WhatsAppError ? e.code : "meta_error", e instanceof WhatsAppError ? e.message : "Meta rechazó el alta.")
    }
  }

  // ---------------------------------------------------------------------------
  if (body?.action === "retry_sync") {
    const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "whatsapp" })
    const secret = parseSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
    const config = await currentConfig()
    if (!secret || !config?.phone_number_id) return fail(404, "no_connection", "WhatsApp no está conectado.")
    try {
      await requestSync(secret.access_token, config.phone_number_id, "smb_app_state_sync")
      await requestSync(secret.access_token, config.phone_number_id, "history")
      return json({ ok: true })
    } catch (e) {
      return fail(400, "sync_failed", e instanceof WhatsAppError ? e.message : "Meta no aceptó la sincronización.")
    }
  }

  // ---------------------------------------------------------------------------
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
    const display = info.display_phone_number ?? null
    const result = await store({ access_token: accessToken, app_secret: appSecret, verify_token: verifyToken, mode: "manual" }, display, {
      phone_number_id: phoneNumberId,
      display_phone_number: display,
      verified_name: info.verified_name ?? null,
      mode: "manual",
      coexistence: false,
    })
    if (result instanceof Response) return result
    return json({ ok: true, display_phone_number: display, webhook_url: webhookUrl(result), verify_token: verifyToken })
  }

  // ---------------------------------------------------------------------------
  if (body?.action === "settings") {
    const config = await currentConfig()
    if (!config) return fail(404, "no_connection", "WhatsApp no está conectado.")
    const categories = (Array.isArray(body.categories) ? body.categories : [])
      .map((c) => (typeof c === "string" ? c.trim().slice(0, 60) : ""))
      .filter(Boolean)
      .slice(0, 15)
    const retention = typeof body.retention_days === "number" && body.retention_days >= 1 ? Math.min(3650, Math.trunc(body.retention_days)) : null
    await admin.rpc("integration_set_config", {
      p_workspace_id: workspaceId,
      p_provider: "whatsapp",
      p_config: { ...config, categories: categories.length ? categories : DEFAULT_CATEGORIES, retention_days: retention },
    })
    if (retention) await admin.rpc("whatsapp_purge", { p_workspace_id: workspaceId, p_days: retention })
    return json({ ok: true })
  }

  // ---------------------------------------------------------------------------
  if (body?.action === "webhook_info") {
    const { data: integ } = await admin.from("integrations").select("id").eq("workspace_id", workspaceId).eq("provider", "whatsapp").maybeSingle()
    if (!integ) return fail(404, "no_connection", "WhatsApp no está conectado.")
    const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "whatsapp" })
    const secret = parseSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
    if (!secret?.verify_token) return fail(400, "embedded", "Esta conexión usa el webhook central de Delega: no hay nada que configurar.")
    return json({ webhook_url: webhookUrl(integ.id), verify_token: secret.verify_token })
  }

  // ---------------------------------------------------------------------------
  if (body?.action === "disconnect") {
    const config = await currentConfig()
    const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "whatsapp" })
    const secret = parseSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
    if (secret?.mode === "embedded" && config?.waba_id) {
      // Deja de recibir avisos de esa cuenta (sin esperar si Meta tarda).
      await fetch(`${GRAPH}/${encodeURIComponent(config.waba_id)}/subscribed_apps`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${secret.access_token}` },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined)
    }
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "whatsapp", p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar WhatsApp.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
