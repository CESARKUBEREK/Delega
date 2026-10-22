// Utilidades de la bandeja (correo y Telegram).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { accessTokenFrom, GoogleError } from "./google.ts"

export const DEFAULT_CATEGORIES = ["Cliente", "Proveedor", "Obra o proyecto", "Administración", "Personal", "Publicidad", "Otros"]

export type InboxConfig = {
  email?: string
  bot_username?: string
  categories?: string[]
  retention_days?: number | null
  history_id?: string | null
  sync_days?: number
  last_sync_at?: string
}

export async function recordMessage(
  admin: SupabaseClient,
  m: {
    workspaceId: string
    integrationId: string | null
    channel: "email" | "telegram"
    threadExternalId: string
    externalId: string
    direction: "in" | "out"
    senderName: string | null
    senderAddress: string | null
    recipients?: string | null
    subject?: string | null
    body: string
    sentAt: string
    contactName: string | null
    contactAddress: string | null
    runId?: string | null
  },
): Promise<number | null> {
  const { data } = await admin.rpc("inbox_record_message", {
    p_workspace_id: m.workspaceId,
    p_integration_id: m.integrationId,
    p_channel: m.channel,
    p_thread_external_id: m.threadExternalId,
    p_external_id: m.externalId,
    p_direction: m.direction,
    p_sender_name: m.senderName ?? "",
    p_sender_address: m.senderAddress ?? "",
    p_recipients: m.recipients ?? "",
    p_subject: m.subject ?? "",
    p_body: m.body,
    p_sent_at: m.sentAt,
    p_contact_name: m.contactName ?? "",
    p_contact_address: m.contactAddress ?? "",
    p_run_id: m.runId ?? null,
  })
  return (data as number | null) ?? null
}

// Access token de Gmail del espacio (o error claro si Google retiró el acceso).
export async function gmailToken(admin: SupabaseClient, workspaceId: string): Promise<{ token: string; config: InboxConfig; integrationId: string }> {
  const [{ data: secretRows }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "gmail" }),
    admin.from("integrations").select("id, status, config").eq("workspace_id", workspaceId).eq("provider", "gmail").maybeSingle(),
  ])
  const secret = secretRows?.[0] as { refresh_token: string } | undefined
  if (!secret || !integ) throw new GoogleError("not_found", "Gmail no está conectado.")
  if (integ.status !== "active") throw new GoogleError("invalid_grant", "Google retiró el acceso a Gmail. Vuelve a conectarlo.")
  try {
    const { token } = await accessTokenFrom(secret.refresh_token)
    return { token, config: (integ.config ?? {}) as InboxConfig, integrationId: integ.id }
  } catch (e) {
    if (e instanceof GoogleError && e.code === "invalid_grant") {
      await admin.rpc("integration_mark_invalid", { p_workspace_id: workspaceId, p_provider: "gmail" })
      throw new GoogleError("invalid_grant", "Google retiró el acceso a Gmail. Vuelve a conectarlo.")
    }
    throw e
  }
}
