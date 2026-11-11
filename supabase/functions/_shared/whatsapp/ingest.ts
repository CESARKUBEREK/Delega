// Entrada de eventos normalizados a la bandeja, igual para todos los
// proveedores. Lo que llega es un dato, nunca una orden para el agente.
//
// - message.inbound: se registra en la bandeja y lanza las automatizaciones
//   activas con disparador "whatsapp_message" (solo las creadas por un owner o
//   admin; como mucho 3 por mensaje y 30 ejecuciones por hora). Lo que quieran
//   contestar espera la aprobación de una persona.
// - El resto (estados, ecos, desconocidos) aún no se procesa: llegará con la
//   Cloud API de Meta (W2).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim, createRun, type RunRow } from "../agent.ts"
import { isUuid, isWorkspaceAdmin } from "../core.ts"
import { recordMessage } from "../inbox.ts"
import { isRouteError, planRun, stepCount } from "../router/index.ts"
import { TRIGGER_TEXT_CHARS } from "../triggers.ts"
import { inboundText } from "../whatsapp.ts"
import type { ConnectionContext, InboundMessageEvent, NormalizedEvent } from "./contract.ts"

const MAX_RUNS_PER_HOUR = 30
const MAX_FLOWS_PER_MESSAGE = 3

type Incoming = { sid: string; phone: string; name: string | null; text: string }

async function launchFlows(admin: SupabaseClient, workspaceId: string, msg: Incoming, messageId: number) {
  const { data: flows } = await admin
    .from("flows")
    .select("id, name, definition, created_by, settings")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .eq("definition->trigger->>type", "whatsapp_message")
    .order("created_at")
    .limit(MAX_FLOWS_PER_MESSAGE)
  if (!flows?.length) return

  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("trigger->>type", "whatsapp_message")
    .gte("started_at", new Date(Date.now() - 3_600_000).toISOString())
  let budget = MAX_RUNS_PER_HOUR - (count ?? 0)

  for (const flow of flows) {
    // La bandeja solo la ven los administradores: solo flujos creados por uno.
    if (!(await isWorkspaceAdmin(admin, workspaceId, flow.created_by))) continue
    if (budget-- <= 0) break
    const settings = (flow.settings ?? {}) as { file_ids?: unknown; model?: unknown }
    const conn = await planRun(admin, workspaceId, { flowId: flow.id, flowSettings: flow.settings, steps: stepCount(flow.definition), allowTrialRun: true })
    if (isRouteError(conn)) return
    const fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter(isUuid).slice(0, 5) : []
    try {
      const run = await createRun(admin, {
        workspaceId,
        flow,
        fileIds,
        note: "",
        model: conn.model,
        routing: conn,
        startedBy: flow.created_by,
        trigger: { type: "whatsapp_message", phone: msg.phone, name: msg.name, message_id: messageId, text: msg.text.slice(0, TRIGGER_TEXT_CHARS) },
      })
      await admin.from("inbox_messages").update({ run_id: run.id }).eq("id", messageId)
      const claimed: RunRow | null = await claim(admin, run.id, "running")
      if (claimed) await advance(admin, claimed, 60_000)
    } catch (e) {
      console.error("whatsapp ingest launch", e instanceof Error ? e.name : "error")
    }
  }
}

async function ingestInbound(admin: SupabaseClient, conn: ConnectionContext, ev: InboundMessageEvent) {
  const text = inboundText(ev)
  if (!text) return
  const msg: Incoming = { sid: ev.providerMessageId, phone: ev.from, name: ev.name, text }
  const id = await recordMessage(admin, {
    workspaceId: conn.workspaceId,
    integrationId: conn.integrationId,
    channel: "whatsapp",
    threadExternalId: msg.phone,
    externalId: msg.sid,
    direction: "in",
    senderName: msg.name,
    senderAddress: msg.phone,
    body: msg.text,
    sentAt: ev.at,
    contactName: msg.name,
    contactAddress: msg.phone,
  })
  // null: ya estaba registrado (el proveedor reintenta si no respondemos a tiempo).
  if (id && ev.source === "api") await launchFlows(admin, conn.workspaceId, msg, id)
}

export async function ingestEvents(admin: SupabaseClient, conn: ConnectionContext, events: NormalizedEvent[]): Promise<void> {
  for (const ev of events) {
    if (ev.type === "message.inbound") await ingestInbound(admin, conn, ev)
  }
}
