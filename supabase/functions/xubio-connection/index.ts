// xubio-connection: conecta la cuenta de Xubio de un espacio con el Client ID y
// el Secret ID de «Configuración → Integraciones → API de Xubio» (planes que
// incluyen la API). Solo owners y admins. Acceso de solo lectura.
//   save        comprueba las credenciales con Xubio y las guarda en Vault.
//   disconnect  borra la conexión (conviene borrar también la app cliente en Xubio).
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { checkXubio, XUBIO_ID_RE, XubioError } from "../_shared/xubio.ts"

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin, userId } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede gestionar Xubio en este espacio.")

  if (body?.action === "save") {
    const clientId = typeof body.client_id === "string" ? body.client_id.trim() : ""
    const secretId = typeof body.secret_id === "string" ? body.secret_id.trim() : ""
    if (!XUBIO_ID_RE.test(clientId) || !XUBIO_ID_RE.test(secretId)) {
      return fail(400, "invalid_format", "Revisa el Client ID y el Secret ID: copia los dos completos.")
    }
    const creds = { client_id: clientId, secret_id: secretId }
    let info
    try {
      info = await checkXubio(creds)
    } catch (e) {
      return fail(400, "invalid_credentials", e instanceof XubioError ? e.message : "Xubio no reconoce las credenciales.")
    }
    const { error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "xubio",
      p_refresh_token: JSON.stringify(creds),
      p_account_email: `Xubio (${info.clients} clientes)`,
      p_scopes: "",
      p_actor: userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    return json({ ok: true, clients: info.clients })
  }

  if (body?.action === "disconnect") {
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "xubio", p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar Xubio.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
