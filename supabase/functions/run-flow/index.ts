// run-flow: ejecuciones lanzadas por una persona desde el panel o desde el chat.
// Acciones: start, start_from_message, continue, decide, cancel. El agente vive
// en _shared/agent.ts.
//
// La ejecución avanza por tramos (como mucho ~90 s por petición). Si no
// termina, queda en "running" y el panel pide "continue". Un lease en la fila
// impide que dos peticiones avancen la misma ejecución a la vez.
//
// Al lanzar una ejecución o decidir una aprobación, el primer tramo arranca
// también en segundo plano: así avanza aunque se cierre la app del móvil
// justo después de tocar «Aprobar».
import { type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { authenticate, fail, isUuid, json, membershipRole, type AuthContext } from "../_shared/core.ts"
import { addEvent, advance, claim, createRun, RunError, type RunRow } from "../_shared/agent.ts"
import { decideRun } from "../_shared/decide.ts"
import { NO_AI_MESSAGE, resolveAi } from "../_shared/llm.ts"

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

function kick(admin: SupabaseClient, runId: string) {
  if (typeof EdgeRuntime === "undefined") return
  EdgeRuntime.waitUntil(
    (async () => {
      const claimed = await claim(admin, runId, "running")
      if (claimed) await advance(admin, claimed, 60_000)
    })().catch((e) => console.error("run-flow kick", e instanceof Error ? e.name : "error")),
  )
}

// IA activa (la del modelo de la automatización o la principal) y límite de
// 10 ejecuciones cada 10 minutos por persona.
async function readyToRun(ctx: AuthContext, workspaceId: string, preferredModel?: string | null): Promise<{ model: string } | Response> {
  const ai = await resolveAi(ctx.admin, workspaceId, preferredModel)
  if (!ai) return fail(409, "no_connection", NO_AI_MESSAGE)

  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { count } = await ctx.admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("started_by", ctx.userId)
    .gte("started_at", since)
  if ((count ?? 0) >= 10) return fail(429, "rate_limited", "Has lanzado muchas ejecuciones seguidas. Espera unos minutos.")
  return { model: ai.model }
}

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
      .select("id, name, definition, settings")
      .eq("id", flowId)
      .eq("workspace_id", workspaceId)
      .maybeSingle()
    if (!flow) return fail(404, "not_found", "No se encontró la automatización.")

    const flowModel = (flow.settings as { model?: unknown } | null)?.model
    const ai = await readyToRun(ctx, workspaceId, typeof flowModel === "string" ? flowModel : null)
    if (ai instanceof Response) return ai

    const run = await createRun(ctx.admin, {
      workspaceId,
      flow,
      fileIds,
      note,
      model: ai.model,
      startedBy: ctx.userId,
      trigger: { type: "manual" },
    })
    // El panel de la ejecución pide "continue" y va mostrando el avance.
    kick(ctx.admin, run.id)
    return json({ run_id: run.id, status: "running" })
  }

  // «Ejecutar ahora» desde el chat: el plan se lee de la base de datos (RLS),
  // nunca del navegador, y no se guarda como automatización.
  if (action === "start_from_message") {
    const workspaceId = body?.workspace_id
    const messageId = body?.message_id
    if (!isUuid(workspaceId) || typeof messageId !== "number" || !Number.isSafeInteger(messageId) || messageId <= 0) {
      return fail(400, "bad_request", "Datos no válidos.")
    }
    const role = await membershipRole(ctx, workspaceId)
    if (!role) return fail(403, "forbidden", "No perteneces a este espacio.")
    const fileIds = (Array.isArray(body?.file_ids) ? body.file_ids : []).filter(isUuid).slice(0, 5)

    const { data: msg } = await ctx.userClient
      .from("messages")
      .select("id, conversation_id, role, plan")
      .eq("id", messageId)
      .eq("workspace_id", workspaceId)
      .maybeSingle()
    const plan = msg?.plan as { name?: unknown; trigger?: { type?: unknown } } | null | undefined
    if (!msg || msg.role !== "assistant" || !plan || typeof plan !== "object") {
      return fail(404, "not_found", "No se encontró el plan.")
    }
    if (plan.trigger?.type && plan.trigger.type !== "manual") {
      return fail(409, "not_manual", "Este plan arranca solo: guárdalo como automatización para activarlo.")
    }

    // La petición que originó el plan acompaña a la ejecución (cifras, nombres…).
    const { data: ask } = await ctx.userClient
      .from("messages")
      .select("content")
      .eq("conversation_id", msg.conversation_id)
      .eq("workspace_id", workspaceId)
      .eq("role", "user")
      .lt("id", msg.id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()

    const ai = await readyToRun(ctx, workspaceId)
    if (ai instanceof Response) return ai

    const run = await createRun(ctx.admin, {
      workspaceId,
      flow: { id: null, name: typeof plan.name === "string" ? plan.name : "", definition: plan },
      fileIds,
      note: ask?.content ? `Lo que pidió en el chat: ${ask.content}`.slice(0, 2000) : "",
      model: ai.model,
      startedBy: ctx.userId,
      trigger: { type: "chat", conversation_id: msg.conversation_id, message_id: msg.id },
      sourceMessageId: msg.id,
    })
    kick(ctx.admin, run.id)
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
    const decision = await decideRun(ctx.admin, run.id, body?.approve === true, ctx.userId)
    if (!decision.ok) return fail(409, "busy", "La ejecución se está procesando. Recarga la página.")
    // Sigue en segundo plano; el panel también puede retomarla con "continue".
    kick(ctx.admin, run.id)
    return json({ run_id: run.id, status: "running" })
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
