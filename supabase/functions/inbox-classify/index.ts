// inbox-classify: ajustes de la bandeja y clasificación a petición (el botón
// «Volver a clasificar» de una conversación). La clasificación normal la hace
// runs-cron cada minuto sin pulsar nada (ver _shared/inbox-classify.ts).
// Solo owners y admins.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"
import { classifyPending } from "../_shared/inbox-classify.ts"
import { NO_AI_MESSAGE } from "../_shared/llm.ts"

const BUDGET_MS = 90_000

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const { admin } = ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const workspaceId = body?.workspace_id
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") return fail(403, "forbidden", "Solo un administrador puede clasificar la bandeja.")

  // Las categorías se guardan en las integraciones de la bandeja (correo, Telegram y WhatsApp).
  const { data: integs } = await admin.from("integrations").select("provider, config").eq("workspace_id", workspaceId).in("provider", ["imap", "telegram", "whatsapp"])

  // Ajustes de la bandeja: se guardan en todas las integraciones de la bandeja.
  if (body?.action === "settings") {
    if (!integs?.length) return fail(409, "no_inbox", "Conecta un correo, Telegram o WhatsApp primero.")
    const categories = Array.isArray(body.categories)
      ? [...new Set(body.categories.filter((c): c is string => typeof c === "string").map((c) => c.trim().slice(0, 60)).filter(Boolean))].slice(0, 15)
      : []
    if (categories.length < 2) return fail(400, "bad_categories", "Escribe al menos dos categorías.")
    const days = typeof body.retention_days === "number" && body.retention_days >= 1 ? Math.min(3650, Math.trunc(body.retention_days)) : null
    const drafts = typeof body.drafts_per_day === "number" && body.drafts_per_day >= 0 ? Math.min(200, Math.trunc(body.drafts_per_day)) : 30
    for (const i of integs) {
      await admin.rpc("integration_set_config", {
        p_workspace_id: workspaceId,
        p_provider: i.provider,
        p_config: { ...(i.config ?? {}), categories, retention_days: days, drafts_per_day: drafts },
      })
    }
    if (days) await admin.rpc("inbox_purge", { p_workspace_id: workspaceId, p_days: days })
    return json({ ok: true })
  }

  const one = isUuid(body?.thread_id) ? body.thread_id : null
  const result = await classifyPending(admin, workspaceId, { deadline: Date.now() + BUDGET_MS, threadId: one, userId: ctx.userId })
  if (result.error) return fail(result.error.code === "limit" ? 429 : 409, result.error.code, result.error.code === "no_ai" ? NO_AI_MESSAGE : result.error.message)
  return json({ ok: true, classified: result.classified, by_rules: result.byRules, remaining: result.remaining, failed: result.failed })
})
