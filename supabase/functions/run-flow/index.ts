// run-flow: ejecuciones lanzadas por una persona desde el panel.
// Acciones: start, continue, decide, cancel. El agente vive en _shared/agent.ts.
//
// La ejecución avanza por tramos (como mucho ~90 s por petición). Si no
// termina, queda en "running" y el panel pide "continue". Un lease en la fila
// impide que dos peticiones avancen la misma ejecución a la vez.
import { authenticate, fail, isUuid, json, membershipRole, type AuthContext } from "../_shared/core.ts"
import { addEvent, addToolResult, advance, claim, createRun, executePending, RunError, type RunRow, save } from "../_shared/agent.ts"
import { defaultConnection } from "../_shared/llm.ts"

async function canManage(ctx: AuthContext, run: RunRow): Promise<boolean> {
  if (run.started_by === ctx.userId) return true
  const role = await membershipRole(ctx, run.workspace_id)
  return role === "owner" || role === "admin"
}

async function loadRun(ctx: AuthContext, runId: unknown): Promise<RunRow | Response> {
  if (!isUuid(runId)) return fail(400, "bad_request", "Ejecución no válida.")
  // Visibilidad con el cliente del usuario (RLS) y datos completos con admin.
  const { data: visible } = await ctx.userClient.from("flow_runs").select("id").eq("id", runId).maybeSingle()
  if (!visible) return fail(404, "not_found", "No se encontró la ejecución.")
  const { data } = await ctx.admin.from("flow_runs").select("*").eq("id", runId).single()
  if (!data) return fail(404, "not_found", "No se encontró la ejecución.")
  const run = data as RunRow
  if (!(await canManage(ctx, run))) return fail(403, "forbidden", "Solo quien lanzó la ejecución o un administrador puede gestionarla.")
  return run
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const action = body?.action

  if (action === "start") {
    const workspaceId = body?.workspace_id
    const flowId = body?.flow_id
    if (!isUuid(workspaceId) || !isUuid(flowId)) return fail(400, "bad_request", "Datos no válidos.")
    const role = await membershipRole(ctx, workspaceId)
    if (!role) return fail(403, "forbidden", "No perteneces a este espacio.")

    const fileIds = (Array.isArray(body?.file_ids) ? body.file_ids : []).filter(isUuid).slice(0, 5)
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : ""

    const { data: flow } = await ctx.userClient
      .from("flows")
      .select("id, name, definition")
      .eq("id", flowId)
      .eq("workspace_id", workspaceId)
      .maybeSingle()
    if (!flow) return fail(404, "not_found", "No se encontró la automatización.")

    const found = await defaultConnection(ctx.admin, workspaceId)
    if ("error" in found) return fail(409, found.code, found.error)

    const since = new Date(Date.now() - 10 * 60_000).toISOString()
    const { count } = await ctx.admin
      .from("flow_runs")
      .select("id", { count: "exact", head: true })
      .eq("started_by", ctx.userId)
      .gte("started_at", since)
    if ((count ?? 0) >= 10) return fail(429, "rate_limited", "Has lanzado muchas ejecuciones seguidas. Espera unos minutos.")

    const run = await createRun(ctx.admin, {
      workspaceId,
      flow,
      fileIds,
      note,
      provider: found.conn.provider,
      model: found.conn.model,
      startedBy: ctx.userId,
      trigger: { type: "manual" },
    })
    // El panel de la ejecución pide "continue" enseguida y va mostrando el avance.
    return json({ run_id: run.id, status: "running" })
  }

  if (action === "continue") {
    const run = await loadRun(ctx, body?.run_id)
    if (run instanceof Response) return run
    if (run.status !== "running") return json({ run_id: run.id, status: run.status })
    const claimed = await claim(ctx.admin, run.id, "running")
    if (!claimed) return json({ run_id: run.id, status: "running", busy: true })
    return json({ run_id: run.id, status: await advance(ctx.admin, claimed) })
  }

  if (action === "decide") {
    const run = await loadRun(ctx, body?.run_id)
    if (run instanceof Response) return run
    if (run.status !== "awaiting_approval" || !run.pending_action) {
      return fail(409, "not_pending", "Esta ejecución no está esperando tu aprobación.")
    }
    const approve = body?.approve === true
    const claimed = await claim(ctx.admin, run.id, "awaiting_approval")
    if (!claimed || !claimed.pending_action) return fail(409, "busy", "La ejecución se está procesando. Recarga la página.")
    const pending = claimed.pending_action

    let output: string
    if (approve) {
      output = await executePending(ctx.admin, claimed, pending, ctx.userId)
    } else {
      output = JSON.stringify({ ok: false, rejected: true, message: "El usuario rechazó esta acción." })
      await addEvent(ctx.admin, claimed, "rejected", "Rechazado por el usuario", { tool: pending.tool, decided_by: ctx.userId })
    }

    addToolResult(claimed, pending.call_id, output)
    claimed.status = "running"
    claimed.pending_action = null
    // El panel retoma la ejecución con "continue".
    await save(ctx.admin, claimed, { status: "running", pending_action: null, lease_until: null })
    return json({ run_id: claimed.id, status: "running" })
  }

  if (action === "cancel") {
    const run = await loadRun(ctx, body?.run_id)
    if (run instanceof Response) return run
    if (!["running", "awaiting_approval"].includes(run.status)) return json({ run_id: run.id, status: run.status })
    await ctx.admin
      .from("flow_runs")
      .update({ status: "cancelled", pending_action: null, lease_until: null, finished_at: new Date().toISOString() })
      .eq("id", run.id)
    await addEvent(ctx.admin, run, "error", "Ejecución cancelada por el usuario")
    return json({ run_id: run.id, status: "cancelled" })
  }

  return fail(400, "bad_request", "Acción no válida.")
}

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (e) {
    if (e instanceof RunError) return fail(500, "run_failed", e.message)
    console.error("run-flow", e instanceof Error ? e.name : "error")
    return fail(500, "internal", "Algo ha fallado durante la ejecución.")
  }
})
