// hubspot-connection: conecta una cuenta de HubSpot a un espacio con una clave
// de servicio (o token de app privada). Solo owners y admins.
//   save        comprueba la clave con HubSpot y la guarda en Vault.
//   disconnect  borra la conexión (la clave sigue existiendo en HubSpot:
//               conviene revocarla allí también).
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { accountInfo, HubSpotError, TOKEN_RE } from "../_shared/hubspot.ts"

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin, userId } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede gestionar HubSpot en este espacio.")

  if (body?.action === "save") {
    const token = typeof body.token === "string" ? body.token.trim() : ""
    if (!TOKEN_RE.test(token)) return fail(400, "invalid_format", "La clave no tiene el formato esperado (suele empezar por «pat-»).")
    let info
    try {
      info = await accountInfo(token)
    } catch (e) {
      return fail(400, "invalid_token", e instanceof HubSpotError ? e.message : "HubSpot no reconoce la clave.")
    }
    const { error } = await admin.rpc("integration_save", {
      p_workspace_id: workspaceId,
      p_provider: "hubspot",
      p_refresh_token: token,
      p_account_email: info.portalId ? `Cuenta ${info.portalId}` : "Cuenta de HubSpot",
      p_scopes: "",
      p_actor: userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    await admin.rpc("integration_set_config", {
      p_workspace_id: workspaceId,
      p_provider: "hubspot",
      p_config: { portal_id: info.portalId, ui_domain: info.uiDomain, timezone: info.timeZone },
    })
    return json({ ok: true, portal_id: info.portalId })
  }

  if (body?.action === "disconnect") {
    const { error } = await admin.rpc("integration_delete", { p_workspace_id: workspaceId, p_provider: "hubspot", p_actor: userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar HubSpot.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
