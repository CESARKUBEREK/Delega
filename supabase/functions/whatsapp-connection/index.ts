// whatsapp-connection: conecta una cuenta de Twilio para WhatsApp a un espacio.
// Solo owners y admins.
//   save        comprueba el Account SID y el Auth Token con Twilio, guarda las
//               credenciales en Vault y devuelve la URL que hay que pegar en
//               Twilio («When a message comes in»).
//   disconnect  borra la conexión (los mensajes ya recibidos se quedan en la bandeja).
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { DEFAULT_CATEGORIES } from "../_shared/inbox.ts"
import { ACCOUNT_SID_RE, AUTH_TOKEN_RE, PHONE_RE, SANDBOX_NUMBER, verifyTwilio, WhatsAppError } from "../_shared/whatsapp.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!

function webhookUrl(integrationId: string): string {
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
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede gestionar WhatsApp en este espacio.")

  if (body?.action === "save") {
    const sid = typeof body.account_sid === "string" ? body.account_sid.trim() : ""
    const token = typeof body.auth_token === "string" ? body.auth_token.trim() : ""
    const from = (typeof body.from === "string" ? body.from.replace(/[\s()-]/g, "") : "") || SANDBOX_NUMBER
    if (!ACCOUNT_SID_RE.test(sid)) return fail(400, "invalid_sid", "El Account SID empieza por AC y tiene 34 caracteres.")
    if (!AUTH_TOKEN_RE.test(token)) return fail(400, "invalid_token", "El Auth Token tiene 32 caracteres (letras a-f y números).")
    if (!PHONE_RE.test(from)) return fail(400, "invalid_from", "Escribe el número remitente con prefijo internacional, por ejemplo +14155238886.")
    let account
    try {
      account = await verifyTwilio(sid, token)
    } catch (e) {
      return fail(400, "invalid_credentials", e instanceof WhatsAppError ? e.message : "Twilio no reconoce esas credenciales.")
    }
    const { data: integrationId, error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "whatsapp",
      p_refresh_token: JSON.stringify({ provider: "twilio", account_sid: sid, auth_token: token, from }),
      p_account_email: from,
      p_scopes: "",
      p_actor: userId,
    })
    if (error || !integrationId) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    const { data: prev } = await admin.from("integrations").select("config").eq("workspace_id", workspaceId).eq("provider", "whatsapp").maybeSingle()
    await admin.rpc("integration_set_config", {
      p_workspace_id: workspaceId,
      p_provider: "whatsapp",
      p_config: {
        categories: DEFAULT_CATEGORIES,
        ...(prev?.config ?? {}),
        provider: "twilio",
        from,
        sandbox: from === SANDBOX_NUMBER,
        account_name: account.friendly_name.slice(0, 120),
      },
    })
    return json({ ok: true, webhook_url: webhookUrl(integrationId as string), sandbox: from === SANDBOX_NUMBER })
  }

  if (body?.action === "disconnect") {
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "whatsapp", p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar WhatsApp.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
