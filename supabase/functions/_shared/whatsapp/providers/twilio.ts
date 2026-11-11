// Adaptador de Twilio (entorno de pruebas +14155238886 o número propio
// aprobado en Twilio). Es el único archivo que conoce la API de Twilio.
//
// Secreto en Vault (integrations, provider "whatsapp"):
//   { provider: "twilio", account_sid, auth_token, from }
//
// Webhook: una URL por integración (?c=<integración>), firmada con
// X-Twilio-Signature (HMAC-SHA1 con el Auth Token de la cuenta conectada).
import {
  CONTRACT_VERSION,
  type ConnectionContext,
  type InboundMessageEvent,
  type MessageStatusEvent,
  type NormalizedEvent,
  type OutboundMessage,
  type ParsedWebhook,
  type ProviderCapabilities,
  type ProviderError,
  type RawWebhook,
  type SendResult,
  type WebhookAck,
  WhatsAppError,
  type WhatsAppProvider,
} from "../contract.ts"

export const ACCOUNT_SID_RE = /^AC[0-9a-f]{32}$/
export const AUTH_TOKEN_RE = /^[0-9a-f]{32}$/
export const SANDBOX_NUMBER = "+14155238886"
const PHONE_RE = /^\+[1-9][0-9]{6,14}$/
const MESSAGE_SID_RE = /^(SM|MM)[0-9a-f]{32}$/
// Twilio corta el texto de WhatsApp en 1600 caracteres.
const MAX_CHARS = 1600
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

function basic(sid: string, token: string) {
  return `Basic ${btoa(`${sid}:${token}`)}`
}

// "whatsapp:+34600111222" → "+34600111222" (o null si no es un número válido).
function phoneOf(address: string | null | undefined): string | null {
  const p = (address ?? "").replace(/^whatsapp:/, "").trim()
  return PHONE_RE.test(p) ? p : null
}

// Firma de Twilio (X-Twilio-Signature): HMAC-SHA1, con el Auth Token como
// clave, de la URL completa a la que llamó Twilio seguida de los parámetros
// del formulario ordenados por nombre (nombre y valor pegados), en base64.
export async function twilioSignature(authToken: string, url: string, params: [string, string][]): Promise<string> {
  const sorted = [...params].sort(([a, va], [b, vb]) => (a < b ? -1 : a > b ? 1 : va < vb ? -1 : va > vb ? 1 : 0))
  const data = url + sorted.map(([k, v]) => k + v).join("")
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"])
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)))
  let bin = ""
  for (const b of mac) bin += String.fromCharCode(b)
  return btoa(bin)
}

export async function validTwilioSignature(authToken: string, url: string, params: [string, string][], signature: string): Promise<boolean> {
  if (!signature) return false
  const expected = await twilioSignature(authToken, url, params)
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

type TwilioReply<T> = { ok: true; data: T } | { ok: false; error: ProviderError }

async function call<T>(fetchFn: FetchFn, creds: { account_sid: string; auth_token: string }, path: string, form?: Record<string, string>): Promise<TwilioReply<T>> {
  let res: Response
  try {
    res = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${creds.account_sid}${path}`, {
      method: form ? "POST" : "GET",
      headers: {
        Authorization: basic(creds.account_sid, creds.auth_token),
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    // Sin respuesta: el mensaje pudo salir o no. No se reintenta a ciegas.
    return { ok: false, error: { kind: "unknown_outcome", code: "unavailable", message: "Twilio no respondió a tiempo." } }
  }
  const data = (await res.json().catch(() => ({}))) as T & { code?: number; message?: string }
  if (res.ok) return { ok: true, data }
  return { ok: false, error: twilioError(res.status, data, res.headers.get("retry-after")) }
}

export function twilioError(status: number, data: { code?: number; message?: string }, retryAfter?: string | null): ProviderError {
  if (status === 401 || status === 404) return { kind: "auth", code: "invalid_credentials", message: "Twilio no reconoce el Account SID o el Auth Token." }
  // Errores habituales de WhatsApp en Twilio.
  if (data.code === 63015) return { kind: "permanent", code: "not_in_sandbox", message: "Ese número no se ha unido al entorno de pruebas de Twilio (tiene que enviar «join …» primero)." }
  if (data.code === 63016) return { kind: "window_closed", code: "outside_window", message: "Han pasado más de 24 horas desde su último mensaje: WhatsApp solo permite plantillas aprobadas." }
  if (data.code === 21211 || data.code === 21614) return { kind: "permanent", code: "bad_number", message: "El número de destino no es válido para WhatsApp." }
  if (data.code === 21606 || data.code === 63007) return { kind: "permanent", code: "bad_sender", message: "El número remitente no está habilitado para WhatsApp en tu cuenta de Twilio." }
  const message = `Twilio devolvió un error: ${String(data.message ?? status).slice(0, 200)}`
  if (status === 429) {
    const sec = Number(retryAfter)
    return { kind: "rate_limited", code: "api_error", message, ...(Number.isFinite(sec) && sec > 0 ? { retryAfterSec: sec } : {}) }
  }
  if (status >= 500) return { kind: "transient", code: "api_error", message }
  return { kind: "permanent", code: "api_error", message }
}

/** Alta: comprueba las credenciales. Solo lo usa la función whatsapp-connection. */
export async function verifyTwilio(accountSid: string, authToken: string, fetchFn: FetchFn = fetch): Promise<{ friendly_name: string; status: string }> {
  const r = await call<{ friendly_name?: string; status?: string }>(fetchFn, { account_sid: accountSid, auth_token: authToken }, ".json")
  if (!r.ok) throw new WhatsAppError(r.error.code, r.error.message)
  if (r.data.status && r.data.status !== "active") throw new WhatsAppError("inactive", "La cuenta de Twilio no está activa.")
  return { friendly_name: r.data.friendly_name ?? "", status: r.data.status ?? "active" }
}

const STATUS: Record<string, MessageStatusEvent["status"]> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
  undelivered: "failed",
}

function parseParams(params: URLSearchParams): NormalizedEvent[] {
  const sid = params.get("MessageSid") ?? params.get("SmsMessageSid") ?? ""
  const from = phoneOf(params.get("From"))
  const body = (params.get("Body") ?? "").slice(0, 20_000)
  const numMedia = Math.max(0, Math.min(10, Number(params.get("NumMedia") ?? 0) || 0))
  const lat = Number(params.get("Latitude"))
  const lng = Number(params.get("Longitude"))
  const hasLocation = Boolean(params.get("Latitude") && params.get("Longitude")) && Number.isFinite(lat) && Number.isFinite(lng)

  if (MESSAGE_SID_RE.test(sid) && from && (body.trim() || numMedia > 0 || hasLocation)) {
    const media = Array.from({ length: numMedia }, (_, i) => ({
      ref: params.get(`MediaUrl${i}`) ?? "",
      mime: params.get(`MediaContentType${i}`) ?? undefined,
    }))
    const ev: InboundMessageEvent = {
      type: "message.inbound",
      providerMessageId: sid,
      from,
      name: (params.get("ProfileName") ?? "").trim().slice(0, 200) || null,
      at: new Date().toISOString(),
      text: body,
      media,
      source: "api",
    }
    if (hasLocation) ev.location = { lat, lng }
    return [ev]
  }

  const status = STATUS[params.get("MessageStatus") ?? ""]
  if (MESSAGE_SID_RE.test(sid) && status) {
    const errorCode = params.get("ErrorCode")
    return [{ type: "message.status", providerMessageId: sid, status, at: new Date().toISOString(), ...(errorCode ? { errorCode } : {}) }]
  }
  return [{ type: "unknown", providerType: params.get("MessageStatus") ?? params.get("SmsStatus") ?? "twilio" }]
}

export function createTwilioProvider(deps: { fetch?: FetchFn } = {}): WhatsAppProvider {
  const fetchFn: FetchFn = deps.fetch ?? ((input, init) => fetch(input, init))
  return {
    id: "twilio",
    contractVersion: CONTRACT_VERSION,

    parseSecret(s) {
      if (s.provider !== "twilio" || typeof s.account_sid !== "string" || typeof s.auth_token !== "string" || typeof s.from !== "string") return null
      return {
        phone: s.from,
        credentials: { account_sid: s.account_sid, auth_token: s.auth_token },
        external: { accountId: s.account_sid },
      }
    },

    capabilities(): ProviderCapabilities {
      return {
        coexistence: false,
        historyImport: false,
        templates: false,
        media: false,
        interactive: false,
        readReceipts: false,
        statusWebhooks: true,
        maxTextChars: MAX_CHARS,
      }
    },

    async verifyWebhook(raw: RawWebhook, ctx: ConnectionContext | null) {
      if (!ctx?.credentials.auth_token) return false
      const params = new URLSearchParams(raw.rawBody)
      const ok = await validTwilioSignature(ctx.credentials.auth_token, raw.url, [...params.entries()], raw.headers.get("x-twilio-signature") ?? "")
      // La firma es de esta cuenta y el aviso también.
      return ok && params.get("AccountSid") === ctx.credentials.account_sid
    },

    parseWebhook(raw: RawWebhook, ctx: ConnectionContext | null): Promise<ParsedWebhook> {
      let events: NormalizedEvent[]
      try {
        events = parseParams(new URLSearchParams(raw.rawBody))
      } catch {
        events = [{ type: "unknown", providerType: "unparseable" }]
      }
      return Promise.resolve({ routingKey: { integrationId: ctx?.integrationId, accountId: ctx?.credentials.account_sid }, events })
    },

    webhookAck(): WebhookAck {
      // Twilio espera TwiML: una respuesta vacía no envía nada al cliente.
      return { status: 200, body: EMPTY_TWIML, contentType: "text/xml" }
    },

    async send(ctx: ConnectionContext, msg: OutboundMessage): Promise<SendResult> {
      const creds = { account_sid: ctx.credentials.account_sid ?? "", auth_token: ctx.credentials.auth_token ?? "" }
      const r = await call<{ sid?: string }>(fetchFn, creds, "/Messages.json", { From: `whatsapp:${ctx.phone}`, To: `whatsapp:${msg.to}`, Body: msg.text })
      if (!r.ok) return r
      if (!r.data.sid) return { ok: false, error: { kind: "unknown_outcome", code: "api_error", message: "Twilio no devolvió el identificador del mensaje." } }
      return { ok: true, providerMessageId: r.data.sid }
    },
  }
}
