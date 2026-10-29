// buffer-connection: conecta la cuenta de Buffer (redes sociales) de un espacio
// con su clave de API (Buffer → Settings → API). Solo owners y admins.
//   save        comprueba la clave con Buffer y la guarda en Vault.
//   disconnect  borra la conexión (la clave sigue existiendo en Buffer:
//               conviene borrarla allí también).
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { BUFFER_KEY_RE, BufferError, checkKey } from "../_shared/buffer.ts"

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin, userId } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede gestionar Buffer en este espacio.")

  if (body?.action === "save") {
    const key = typeof body.key === "string" ? body.key.trim() : ""
    if (!BUFFER_KEY_RE.test(key)) return fail(400, "invalid_format", "La clave no tiene el formato esperado.")
    let info
    try {
      info = await checkKey(key)
    } catch (e) {
      return fail(400, "invalid_key", e instanceof BufferError ? e.message : "Buffer no reconoce la clave.")
    }
    const { error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "buffer",
      p_refresh_token: key,
      p_account_email: `Buffer (${info.channels} ${info.channels === 1 ? "canal" : "canales"})`,
      p_scopes: "",
      p_actor: userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    return json({ ok: true, channels: info.channels })
  }

  if (body?.action === "disconnect") {
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "buffer", p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar Buffer.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
