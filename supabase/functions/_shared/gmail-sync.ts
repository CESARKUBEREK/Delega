// Lectura de Gmail por tandas, compartida por inbox-sync (botón «Traer correo»)
// y mail-cron (lectura automática). La primera vez importa los últimos N días
// (por defecto 30); después usa el historial de Gmail para traer solo lo nuevo.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { getMessage, historyMessageIds, listMessageIds, profile } from "./gmail.ts"
import { GoogleError } from "./google.ts"
import { gmailToken, recordMessage } from "./inbox.ts"

const BATCH = 60

export async function syncGmail(admin: SupabaseClient, workspaceId: string, deadline: number): Promise<{ added: number; more: boolean }> {
  const { token, config, integrationId } = await gmailToken(admin, workspaceId)
  if (config.retention_days) await admin.rpc("inbox_purge", { p_workspace_id: workspaceId, p_days: config.retention_days })

  const me = await profile(token)
  const myAddress = me.emailAddress.toLowerCase()

  // Qué mensajes traer.
  let ids: string[] = []
  let nextHistory: string | null = config.history_id ?? null
  let pendingIds = Array.isArray((config as { pending_ids?: unknown }).pending_ids)
    ? ((config as { pending_ids: string[] }).pending_ids)
    : []
  if (pendingIds.length) {
    ids = pendingIds
  } else if (config.history_id) {
    try {
      const h = await historyMessageIds(token, config.history_id, 500)
      ids = h.ids
      nextHistory = h.historyId ?? me.historyId
    } catch (e) {
      // historyId caducado: se vuelve a importar el periodo inicial.
      if (!(e instanceof GoogleError && e.code === "not_found")) throw e
      ids = await listMessageIds(token, `newer_than:${config.sync_days ?? 30}d -in:spam -in:drafts -category:promotions`, 500)
      nextHistory = me.historyId
    }
  } else {
    ids = await listMessageIds(token, `newer_than:${config.sync_days ?? 30}d -in:spam -in:drafts -category:promotions`, 500)
    nextHistory = me.historyId
  }

  // Procesa una tanda; lo que no dé tiempo queda pendiente para la siguiente llamada.
  let added = 0
  let processed = 0
  for (const id of ids.slice(0, BATCH)) {
    if (Date.now() > deadline) break
    processed++
    try {
      const mail = await getMessage(token, id, myAddress)
      const counterpart = mail.outgoing ? { name: null, address: mail.to.split(",")[0]?.trim() ?? "" } : mail.from
      const recorded = await recordMessage(admin, {
        workspaceId,
        integrationId,
        channel: "email",
        threadExternalId: mail.threadId,
        externalId: mail.id,
        direction: mail.outgoing ? "out" : "in",
        senderName: mail.from.name,
        senderAddress: mail.from.address,
        recipients: mail.to,
        subject: mail.subject,
        body: mail.body,
        sentAt: mail.date,
        contactName: mail.outgoing ? null : counterpart.name ?? counterpart.address,
        contactAddress: mail.outgoing ? null : counterpart.address,
      })
      if (recorded) added++
    } catch (e) {
      if (e instanceof GoogleError && e.code === "not_found") continue
      throw e
    }
  }
  pendingIds = ids.slice(processed)

  await admin.rpc("integration_set_config", {
    p_workspace_id: workspaceId,
    p_provider: "gmail",
    p_config: {
      ...config,
      email: myAddress,
      history_id: nextHistory,
      pending_ids: pendingIds.slice(0, 500),
      last_sync_at: new Date().toISOString(),
    },
  })
  return { added, more: pendingIds.length > 0 }
}
