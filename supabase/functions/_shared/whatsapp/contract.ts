// Contrato de la capa de WhatsApp (fase 9b). El núcleo de MarchaSolo (bandeja,
// agentes, aprobaciones, MCP) solo conoce estos tipos; cada proveedor (Twilio
// hoy, la Cloud API de Meta después) es un adaptador en ./providers/.
//
// Reglas:
// - El adaptador no toca la base de datos ni Vault: recibe un
//   ConnectionContext ya resuelto.
// - El adaptador no decide de qué espacio es un mensaje: devuelve una clave de
//   enrutado y el núcleo la resuelve.
// - send() nunca lanza: devuelve un ProviderError normalizado.
//
// Sin «parameter properties» ni enums: los tests de Node cargan este archivo
// con --experimental-strip-types.

export const CONTRACT_VERSION = 1 as const

export type ProviderId = "twilio" | "meta" | "fake"

export interface ConnectionContext {
  integrationId: string
  workspaceId: string
  provider: ProviderId
  /** Número remitente en formato E.164. */
  phone: string
  /** Descifradas solo en memoria. Nunca se registran ni se devuelven al navegador. */
  credentials: Readonly<Record<string, string>>
  external: { wabaId?: string; phoneNumberId?: string; accountId?: string }
}

export interface ProviderCapabilities {
  coexistence: boolean
  historyImport: boolean
  templates: boolean
  media: boolean
  interactive: boolean
  readReceipts: boolean
  statusWebhooks: boolean
  maxTextChars: number
}

export interface RawWebhook {
  rawBody: string
  headers: Headers
  /** URL pública completa a la que llamó el proveedor (para firmas que la incluyen). */
  url: string
}

export interface MediaRef {
  ref: string
  mime?: string
  fileName?: string
  voiceNote?: boolean
}

export interface InboundMessageEvent {
  type: "message.inbound"
  providerMessageId: string
  /** Remitente en E.164. */
  from: string
  name: string | null
  at: string
  text: string
  media: MediaRef[]
  location?: { lat: number; lng: number }
  source: "api" | "history"
}

export interface MessageEchoEvent {
  type: "message.echo"
  providerMessageId: string
  to: string
  at: string
  text: string
  media: MediaRef[]
}

export interface MessageStatusEvent {
  type: "message.status"
  providerMessageId: string
  status: "sent" | "delivered" | "read" | "failed"
  at: string
  errorCode?: string
}

export interface UnknownEvent {
  type: "unknown"
  providerType: string
}

export type NormalizedEvent = InboundMessageEvent | MessageEchoEvent | MessageStatusEvent | UnknownEvent

export interface ParsedWebhook {
  routingKey: { integrationId?: string; phoneNumberId?: string; wabaId?: string; accountId?: string }
  events: NormalizedEvent[]
}

export type OutboundMessage = { kind: "text"; to: string; text: string; idempotencyKey: string }

export type ProviderErrorKind = "transient" | "rate_limited" | "permanent" | "auth" | "window_closed" | "unknown_outcome"

export interface ProviderError {
  kind: ProviderErrorKind
  /** Código estable para la interfaz y los registros (p. ej. "outside_window"). */
  code: string
  /** Texto para el usuario, en español. Sin credenciales ni datos del mensaje. */
  message: string
  retryAfterSec?: number
}

export type SendResult = { ok: true; providerMessageId: string } | { ok: false; error: ProviderError }

export interface WebhookAck {
  status: number
  body: string
  contentType: string
}

export interface WhatsAppProvider {
  readonly id: ProviderId
  readonly contractVersion: typeof CONTRACT_VERSION

  /** Secreto de Vault → credenciales y datos externos, o null si no es de este proveedor. */
  parseSecret(secret: Record<string, unknown>): Pick<ConnectionContext, "phone" | "credentials" | "external"> | null

  capabilities(ctx: ConnectionContext): ProviderCapabilities

  /** ctx es null en proveedores con un único webhook para todos los clientes (Meta). */
  verifyWebhook(raw: RawWebhook, ctx: ConnectionContext | null): Promise<boolean>
  /** Nunca lanza: lo que no entiende sale como evento "unknown". */
  parseWebhook(raw: RawWebhook, ctx: ConnectionContext | null): Promise<ParsedWebhook>
  webhookAck(): WebhookAck

  send(ctx: ConnectionContext, msg: OutboundMessage): Promise<SendResult>
}

export class WhatsAppError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export const ERROR_KINDS: readonly ProviderErrorKind[] = ["transient", "rate_limited", "permanent", "auth", "window_closed", "unknown_outcome"]
