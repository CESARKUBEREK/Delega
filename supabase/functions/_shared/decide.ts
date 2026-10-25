// Decidir la acción que espera aprobación en una ejecución. Lo usan run-flow
// (botones de la app) y telegram-webhook (botones del chat de Telegram), con
// las mismas reglas: la ejecución debe seguir esperando y estar libre (lease).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { addEvent, appendToolResult, claim, executePending, type PendingAction, type RunRow, save } from "./agent.ts"

export type Decision =
  | { ok: true; run: RunRow; pending: PendingAction; output: string }
  | { ok: false; code: "not_pending" | "busy" }

export async function decideRun(
  admin: SupabaseClient,
  runId: string,
  approve: boolean,
  userId: string,
  opts: { via?: "telegram"; expectCallId?: (callId: string) => Promise<boolean> } = {},
): Promise<Decision> {
  const claimed = await claim(admin, runId, "awaiting_approval")
  if (!claimed) return { ok: false, code: "busy" }
  const pending = claimed.pending_action
  if (!pending || (opts.expectCallId && !(await opts.expectCallId(pending.call_id)))) {
    // Se suelta el lease sin tocar nada más.
    await admin.from("flow_runs").update({ lease_until: null }).eq("id", runId)
    return { ok: false, code: "not_pending" }
  }

  let output: string
  if (approve) {
    output = await executePending(admin, claimed, pending, userId)
  } else {
    output = JSON.stringify({ ok: false, rejected: true, message: "El usuario rechazó esta acción." })
    await addEvent(admin, claimed, "rejected", opts.via === "telegram" ? "Rechazado desde Telegram" : "Rechazado por el usuario", {
      tool: pending.tool,
      decided_by: userId,
      ...(opts.via ? { via: opts.via } : {}),
    })
  }
  if (approve && opts.via === "telegram") {
    await addEvent(admin, claimed, "message", "Decisión tomada desde Telegram", { tool: pending.tool, decided_by: userId, via: "telegram" })
  }

  appendToolResult(claimed, pending.call_id, output)
  claimed.status = "running"
  claimed.pending_action = null
  await save(admin, claimed, { status: "running", pending_action: null, lease_until: null })
  return { ok: true, run: claimed, pending, output }
}
