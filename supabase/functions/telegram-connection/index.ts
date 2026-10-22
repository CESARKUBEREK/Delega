// telegram-connection: conecta un bot de Telegram a un espacio. Solo owners y admins.
//   save        valida el token con getMe, lo guarda en Vault y registra el
//               webhook de Delega con un secreto propio.
//   disconnect  quita el webhook en Telegram y borra la conexión.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { randomToken } from "../_shared/google.ts"
import { DEFAULT_CATEGORIES } from "../_shared/inbox.ts"
import { BOT_TOKEN_RE, deleteWebhook, getMe, parseTelegramSecret, setWebhook, TelegramError } from "../_shared/telegram.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin, userId } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede gestionar Telegram en este espacio.")

  if (body?.action === "save") {
    const token = typeof body.bot_token === "string" ? body.bot_token.trim() : ""
    if (!BOT_TOKEN_RE.test(token)) return fail(400, "invalid_format", "El token no tiene el formato de @BotFather (números:letras).")
    let me
    try {
      me = await getMe(token)
    } catch (e) {
      return fail(400, "invalid_token", e instanceof TelegramError ? e.message : "Telegram no reconoce el token.")
    }
    const secretToken = randomToken(32).replace(/[^A-Za-z0-9_-]/g, "")
    const { data: integrationId, error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "telegram",
      p_refresh_token: JSON.stringify({ bot_token: token, secret_token: secretToken }),
      p_account_email: me.username ? `@${me.username}` : null,
      p_scopes: "",
      p_actor: userId,
    })
    if (error || !integrationId) return fail(500, "save_failed", "No se pudo guardar el bot.")
    const { data: prev } = await admin.from("integrations").select("config").eq("workspace_id", workspaceId).eq("provider", "telegram").maybeSingle()
    await admin.rpc("integration_set_config", {
      p_workspace_id: workspaceId,
      p_provider: "telegram",
      p_config: { categories: DEFAULT_CATEGORIES, ...(prev?.config ?? {}), bot_username: me.username ?? null, bot_id: me.id },
    })
    try {
      await setWebhook(token, `${SUPABASE_URL}/functions/v1/telegram-webhook?c=${integrationId}`, secretToken)
    } catch (e) {
      return fail(502, "webhook_failed", e instanceof TelegramError ? e.message : "Telegram no aceptó el webhook.")
    }
    return json({ ok: true, bot_username: me.username ?? null })
  }

  if (body?.action === "disconnect") {
    const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "telegram" })
    const secret = parseTelegramSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
    if (secret) await deleteWebhook(secret.bot_token).catch(() => undefined)
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "telegram", p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar el bot.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
