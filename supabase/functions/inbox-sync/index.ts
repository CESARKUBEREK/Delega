// inbox-sync: trae a la bandeja el correo nuevo del buzón IMAP del espacio.
// Solo owners y admins. Avanza por tandas: si queda más, devuelve more = true
// y el panel vuelve a llamar.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { MailError, syncImap } from "../_shared/imap.ts"
import { launchEmailFlows } from "../_shared/triggers.ts"

const BUDGET_MS = 80_000

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede sincronizar el correo.")

  try {
    const r = await syncImap(admin, workspaceId, Date.now() + BUDGET_MS)
    const launched = await launchEmailFlows(admin, workspaceId, r.fresh).catch(() => 0)
    return json({ ok: true, added: r.added, more: r.more, launched, warnings: [] })
  } catch (e) {
    if (e instanceof MailError && e.code === "mailbox") return fail(409, "no_mail", "Conecta tu correo en Integraciones.")
    return fail(502, "mail_error", e instanceof MailError ? e.message : "No se pudo leer el correo.")
  }
})
