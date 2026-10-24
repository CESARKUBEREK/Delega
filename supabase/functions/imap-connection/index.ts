// imap-connection: conecta un buzón de correo de hosting por IMAP/SMTP. Solo
// owners y admins.
//   save        comprueba IMAP (993) y SMTP (465) con el usuario y la
//               contraseña, y los guarda cifrados en Vault.
//   disconnect  borra la conexión (las conversaciones ya guardadas siguen).
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { closeImap, findSentFolder, HOST_RE, type ImapConfig, MailError, openImap, verifySmtp } from "../_shared/imap.ts"

const EMAIL_RE = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,253}\.[a-z]{2,63}$/i

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin, userId } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede conectar el correo.")

  if (body?.action === "save") {
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
    const email = str(body.email, 320).toLowerCase()
    const user = str(body.user, 320) || email
    const password = typeof body.password === "string" ? body.password.slice(0, 500) : ""
    const imapHost = str(body.imap_host, 253).toLowerCase()
    const smtpHost = str(body.smtp_host, 253).toLowerCase()
    const displayName = str(body.display_name, 120).replace(/[\r\n"<>]/g, "") || null
    if (!EMAIL_RE.test(email)) return fail(400, "bad_email", "Escribe una dirección de correo válida.")
    if (!password) return fail(400, "no_password", "Escribe la contraseña del correo.")
    const testMode = Deno.env.get("MAIL_TEST_INSECURE") === "1"
    if (!testMode && (!HOST_RE.test(imapHost) || !HOST_RE.test(smtpHost))) {
      return fail(400, "bad_host", "Escribe los servidores IMAP y SMTP (por ejemplo, imap.tudominio.com).")
    }

    const secret = { user, password }
    let sentFolder: string | null = null
    try {
      const client = await openImap(imapHost, secret)
      try {
        sentFolder = await findSentFolder(client).catch(() => null)
      } finally {
        await closeImap(client)
      }
      await verifySmtp(smtpHost, secret)
    } catch (e) {
      return fail(400, e instanceof MailError ? e.code : "mail_error", e instanceof MailError ? e.message : "No se pudo comprobar el correo.")
    }

    const { error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "imap",
      p_refresh_token: JSON.stringify(secret),
      p_account_email: email,
      p_scopes: "",
      p_actor: userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo guardar la conexión.")

    // Se conservan los ajustes de la bandeja; la lectura empieza de cero si cambia el servidor o la cuenta.
    const { data: existing } = await admin
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "imap")
      .maybeSingle()
    const prev = (existing?.config ?? {}) as Partial<ImapConfig>
    const sameMailbox = prev.imap_host === imapHost && prev.email === email
    const { data: other } = await admin
      .from("integrations")
      .select("config")
      .eq("workspace_id", workspaceId)
      .eq("provider", "telegram")
      .limit(1)
      .maybeSingle()
    const shared = (other?.config ?? {}) as { categories?: string[]; retention_days?: number | null }
    const config: ImapConfig = {
      categories: prev.categories ?? shared.categories,
      retention_days: prev.retention_days ?? shared.retention_days ?? null,
      sync_days: prev.sync_days ?? 30,
      email,
      display_name: displayName,
      imap_host: imapHost,
      smtp_host: smtpHost,
      sent_folder: sentFolder,
      uid_validity: sameMailbox ? prev.uid_validity ?? null : null,
      last_uid: sameMailbox ? prev.last_uid ?? 0 : 0,
      last_sync_at: sameMailbox ? prev.last_sync_at : undefined,
    }
    await admin.rpc("integration_set_config", { p_workspace_id: workspaceId, p_provider: "imap", p_config: config })
    return json({ ok: true, email, sent_folder: sentFolder })
  }

  if (body?.action === "disconnect") {
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "imap", p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar el correo.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
