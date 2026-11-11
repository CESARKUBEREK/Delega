// Canal WhatsApp: la cara pública de la capa de proveedores (fase 9b). El
// núcleo (agente, bandeja, MCP) importa solo de aquí; nunca de
// ./whatsapp/providers/. El proveedor de cada conexión (Twilio hoy, Meta
// después) lo decide el secreto guardado en Vault.
//
// Reglas de WhatsApp: se puede contestar con texto libre durante las 24 h
// siguientes al último mensaje del cliente. Fuera de esa ventana solo se
// pueden enviar plantillas aprobadas (aún no incluidas).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import type { ConnectionContext, InboundMessageEvent } from "./whatsapp/contract.ts"
import { WhatsAppError } from "./whatsapp/contract.ts"
import { contextFromSecret, getProvider } from "./whatsapp/registry.ts"

export { WhatsAppError }
export type { ConnectionContext as WhatsAppConnection }

export const PHONE_RE = /^\+[1-9][0-9]{6,14}$/
export const WINDOW_MS = 24 * 3_600_000
// Límite común a todos los proveedores (el más bajo: Twilio, 1600).
export const MAX_WHATSAPP_CHARS = 1600

// "whatsapp:+34600111222" → "+34600111222" (o null si no es un número válido).
export function phoneOf(address: string | null | undefined): string | null {
  const p = (address ?? "").replace(/^whatsapp:/, "").trim()
  return PHONE_RE.test(p) ? p : null
}

/** Texto que entra en la bandeja para un mensaje recibido. */
export function inboundText(ev: Pick<InboundMessageEvent, "text" | "media" | "location">): string {
  const parts = [ev.text]
  if (ev.media.length > 0) parts.push(ev.media.length === 1 ? "[archivo adjunto]" : `[${ev.media.length} archivos adjuntos]`)
  if (ev.location) parts.push(`[ubicación ${ev.location.lat}, ${ev.location.lng}]`)
  return parts.filter(Boolean).join(" ").trim()
}

/**
 * Envía texto libre por la conexión. Valida lo común a todos los proveedores
 * y convierte el error del proveedor en WhatsAppError (con un mensaje para el
 * usuario). Devuelve el identificador del mensaje en el proveedor.
 */
export async function sendWhatsApp(conn: ConnectionContext, to: string, text: string, idempotencyKey: string = crypto.randomUUID()): Promise<string> {
  if (!PHONE_RE.test(to)) throw new WhatsAppError("bad_number", "El número de destino no es válido para WhatsApp.")
  const body = text.trim()
  if (!body) throw new WhatsAppError("empty", "Falta el texto del mensaje.")
  const provider = getProvider(conn.provider)
  const max = Math.min(MAX_WHATSAPP_CHARS, provider.capabilities(conn).maxTextChars)
  if (body.length > max) throw new WhatsAppError("too_long", `El mensaje pasa de ${max} caracteres.`)
  const r = await provider.send(conn, { kind: "text", to, text: body, idempotencyKey })
  if (!r.ok) throw new WhatsAppError(r.error.code, r.error.message)
  return r.providerMessageId
}

// ¿Escribió este número en las últimas 24 h? (ventana de atención de WhatsApp)
export async function insideWindow(admin: SupabaseClient, workspaceId: string, phone: string): Promise<boolean> {
  const { data: thread } = await admin
    .from("inbox_threads")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("channel", "whatsapp")
    .eq("external_id", phone)
    .maybeSingle()
  if (!thread) return false
  const { data } = await admin
    .from("inbox_messages")
    .select("sent_at")
    .eq("workspace_id", workspaceId)
    .eq("thread_id", thread.id)
    .eq("direction", "in")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return Boolean(data && Date.parse(data.sent_at) > Date.now() - WINDOW_MS)
}

/** La conexión de WhatsApp activa del espacio, o null. */
export async function whatsappConnection(admin: SupabaseClient, workspaceId: string): Promise<ConnectionContext | null> {
  const { data: integ } = await admin.from("integrations").select("id, status").eq("workspace_id", workspaceId).eq("provider", "whatsapp").maybeSingle()
  if (integ?.status !== "active") return null
  const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "whatsapp" })
  return contextFromSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token, { integrationId: integ.id, workspaceId })
}

/** Para webhooks con una URL por integración (Twilio). null si no existe o no está activa. */
export async function whatsappConnectionById(admin: SupabaseClient, integrationId: string): Promise<ConnectionContext | null> {
  const { data } = await admin.rpc("integration_secret_by_id", { p_integration_id: integrationId })
  const row = data?.[0] as { workspace_id: string; provider: string; secret: string; status: string } | undefined
  if (!row || row.provider !== "whatsapp" || row.status !== "active") return null
  return contextFromSecret(row.secret, { integrationId, workspaceId: row.workspace_id })
}
