// Proveedor falso para tests: sin red. Guarda lo enviado en memoria y permite
// simular errores. Sirve para comprobar que el contrato no depende de Twilio.
//
// Webhook: JSON firmado con HMAC-SHA256 (cabecera x-fake-signature, hex) con
// credentials.webhook_secret.
import {
  CONTRACT_VERSION,
  type ConnectionContext,
  type NormalizedEvent,
  type OutboundMessage,
  type ParsedWebhook,
  type ProviderError,
  type RawWebhook,
  type SendResult,
  type WhatsAppProvider,
} from "../contract.ts"

const PHONE_RE = /^\+[1-9][0-9]{6,14}$/

export async function fakeSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))
  return [...mac].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export type FakeProvider = WhatsAppProvider & {
  sent: OutboundMessage[]
  /** Próximo error que devolverá send(), una sola vez. */
  failNext: ProviderError | null
}

export function createFakeProvider(): FakeProvider {
  let counter = 0
  const provider: FakeProvider = {
    id: "fake",
    contractVersion: CONTRACT_VERSION,
    sent: [],
    failNext: null,

    parseSecret(s) {
      if (s.provider !== "fake" || typeof s.phone !== "string" || typeof s.webhook_secret !== "string") return null
      return { phone: s.phone, credentials: { webhook_secret: s.webhook_secret }, external: { phoneNumberId: String(s.phone_number_id ?? "fake-1") } }
    },

    capabilities() {
      return { coexistence: true, historyImport: false, templates: false, media: true, interactive: false, readReceipts: true, statusWebhooks: true, maxTextChars: 4096 }
    },

    async verifyWebhook(raw: RawWebhook, ctx: ConnectionContext | null) {
      const secret = ctx?.credentials.webhook_secret
      const sig = raw.headers.get("x-fake-signature") ?? ""
      if (!secret || !sig) return false
      return sig === (await fakeSignature(secret, raw.rawBody))
    },

    parseWebhook(raw: RawWebhook): Promise<ParsedWebhook> {
      let body: { phone_number_id?: unknown; messages?: unknown }
      try {
        body = JSON.parse(raw.rawBody)
      } catch {
        return Promise.resolve({ routingKey: {}, events: [{ type: "unknown", providerType: "unparseable" }] })
      }
      const events: NormalizedEvent[] = []
      for (const m of Array.isArray(body.messages) ? body.messages : []) {
        const x = m as Record<string, unknown>
        if (typeof x.id === "string" && typeof x.from === "string" && PHONE_RE.test(x.from) && typeof x.text === "string") {
          events.push({ type: "message.inbound", providerMessageId: x.id, from: x.from, name: typeof x.name === "string" ? x.name : null, at: new Date().toISOString(), text: x.text, media: [], source: "api" })
        } else {
          events.push({ type: "unknown", providerType: String(x.type ?? "message") })
        }
      }
      return Promise.resolve({ routingKey: { phoneNumberId: typeof body.phone_number_id === "string" ? body.phone_number_id : undefined }, events })
    },

    webhookAck() {
      return { status: 200, body: "ok", contentType: "text/plain" }
    },

    send(_ctx: ConnectionContext, msg: OutboundMessage): Promise<SendResult> {
      if (provider.failNext) {
        const error = provider.failNext
        provider.failNext = null
        return Promise.resolve({ ok: false, error })
      }
      provider.sent.push(msg)
      return Promise.resolve({ ok: true, providerMessageId: `fake-${++counter}` })
    },
  }
  return provider
}
