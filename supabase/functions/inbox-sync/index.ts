// inbox-sync: trae a la bandeja el correo nuevo de las cuentas conectadas del
// espacio (Gmail e IMAP). Solo owners y admins. Avanza por tandas: si queda
// más, devuelve more = true y el panel vuelve a llamar.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { syncGmail } from "../_shared/gmail-sync.ts"
import { GoogleError } from "../_shared/google.ts"
import { MailError, syncImap } from "../_shared/imap.ts"

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

  const { data: integs } = await admin
    .from("integrations")
    .select("provider, status")
    .eq("workspace_id", workspaceId)
    .in("provider", ["gmail", "imap"])
    .eq("status", "active")
  const providers = (integs ?? []).map((i) => i.provider)
  if (!providers.length) return fail(409, "no_mail", "Conecta Gmail o un correo IMAP en Integraciones.")

  const start = Date.now()
  let added = 0
  let more = false
  const errors: string[] = []
  for (const [i, provider] of providers.entries()) {
    // Cada cuenta tiene su parte del tiempo disponible.
    const deadline = start + (BUDGET_MS * (i + 1)) / providers.length
    try {
      const r = provider === "gmail" ? await syncGmail(admin, workspaceId, deadline) : await syncImap(admin, workspaceId, deadline)
      added += r.added
      more ||= r.more
    } catch (e) {
      const label = provider === "gmail" ? "Gmail" : "Correo IMAP"
      errors.push(`${label}: ${e instanceof GoogleError || e instanceof MailError ? e.message : "no se pudo leer."}`)
    }
  }
  if (errors.length === providers.length) return fail(502, "mail_error", errors.join(" "))
  return json({ ok: true, added, more, warnings: errors })
})
