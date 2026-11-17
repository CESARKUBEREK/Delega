import test from "node:test"
import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { CONTRACT_VERSION, ERROR_KINDS } from "../supabase/functions/_shared/whatsapp/contract.ts"
import { createTwilioProvider } from "../supabase/functions/_shared/whatsapp/providers/twilio.ts"
import { createFakeProvider, fakeSignature } from "../supabase/functions/_shared/whatsapp/providers/fake.ts"

// Fase 9b (W1): pruebas de contrato. Cada adaptador de WhatsApp debe pasar las
// mismas pruebas, sin red. Para añadir un proveedor (Meta en W2), se añade su
// «fixture» a FIXTURES y nada más.

const IDS = { integrationId: "11111111-2222-3333-4444-555555555555", workspaceId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }
const CUSTOMER = "+5491122334455"

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })
}

// ---------- Twilio ----------
const TW_TOKEN = "0123456789abcdef0123456789abcdef"
const TW_SID = "AC" + "0".repeat(32)
const TW_URL = `https://example.supabase.co/functions/v1/whatsapp-webhook?c=${IDS.integrationId}`

function twilioSign(params) {
  const data = TW_URL + Object.keys(params).sort().map((k) => k + params[k]).join("")
  return createHmac("sha1", TW_TOKEN).update(data, "utf8").digest("base64")
}

function twilioRaw(params, signature = twilioSign(params)) {
  return { rawBody: new URLSearchParams(params).toString(), headers: new Headers(signature ? { "x-twilio-signature": signature } : {}), url: TW_URL }
}

const twilioFixture = {
  name: "twilio",
  make(reply) {
    const calls = []
    const provider = createTwilioProvider({
      fetch: async (url, init) => {
        calls.push({ url, init })
        return reply(url, init)
      },
    })
    const ctx = { ...IDS, provider: "twilio", ...provider.parseSecret({ provider: "twilio", account_sid: TW_SID, auth_token: TW_TOKEN, from: "+14155238886" }) }
    return { provider, ctx, calls }
  },
  okReply: () => jsonResponse(201, { sid: "SM" + "a".repeat(32) }),
  errorReplies: {
    auth: () => jsonResponse(401, { code: 20003, message: "Authenticate" }),
    window_closed: () => jsonResponse(400, { code: 63016, message: "outside window" }),
    permanent: () => jsonResponse(400, { code: 21211, message: "invalid To" }),
    rate_limited: () => jsonResponse(429, { code: 20429, message: "Too many" }, { "retry-after": "7" }),
    transient: () => jsonResponse(503, { message: "unavailable" }),
    unknown_outcome: () => {
      throw new TypeError("network")
    },
  },
  inbound: () =>
    twilioRaw({
      SmsMessageSid: "SM0123456789abcdef0123456789abcdef",
      MessageSid: "SM0123456789abcdef0123456789abcdef",
      AccountSid: TW_SID,
      From: `whatsapp:${CUSTOMER}`,
      To: "whatsapp:+14155238886",
      Body: "Hola, ¿tienen turno el lunes? 👍",
      NumMedia: "0",
      ProfileName: "Ana Pérez",
    }),
  tampered: () => {
    const params = { MessageSid: "SM0123456789abcdef0123456789abcdef", AccountSid: TW_SID, From: `whatsapp:${CUSTOMER}`, Body: "Hola" }
    return twilioRaw({ ...params, Body: "Otro texto" }, twilioSign(params))
  },
  unsigned: () => twilioRaw({ MessageSid: "SM0123456789abcdef0123456789abcdef", AccountSid: TW_SID, From: `whatsapp:${CUSTOMER}`, Body: "Hola" }, ""),
  junk: () => twilioRaw({ foo: "bar", AccountSid: TW_SID }),
}

// ---------- Falso ----------
const FAKE_SECRET = "fake-webhook-secret"

const fakeFixture = {
  name: "fake",
  make(reply) {
    const provider = createFakeProvider()
    const ctx = { ...IDS, provider: "fake", ...provider.parseSecret({ provider: "fake", phone: "+15550001111", webhook_secret: FAKE_SECRET }) }
    const kind = reply?.kind
    if (kind) provider.failNext = { kind, code: `fake_${kind}`, message: "Error simulado." }
    return { provider, ctx, calls: [] }
  },
  okReply: () => null,
  errorReplies: Object.fromEntries(ERROR_KINDS.map((k) => [k, { kind: k }])),
  async signed(body) {
    const rawBody = JSON.stringify(body)
    return { rawBody, headers: new Headers({ "x-fake-signature": await fakeSignature(FAKE_SECRET, rawBody) }), url: "https://example/fake" }
  },
  inbound() {
    return this.signed({ phone_number_id: "fake-1", messages: [{ id: "wamid.1", from: CUSTOMER, name: "Ana Pérez", text: "Hola" }] })
  },
  async tampered() {
    const raw = await this.inbound()
    return { ...raw, rawBody: raw.rawBody.replace("Hola", "Chau") }
  },
  async unsigned() {
    const raw = await this.inbound()
    return { ...raw, headers: new Headers() }
  },
  junk() {
    return this.signed({ messages: [{ type: "reaction" }] })
  },
}

const FIXTURES = [twilioFixture, fakeFixture]

for (const fx of FIXTURES) {
  const okDeps = () => fx.make(fx.name === "fake" ? null : fx.okReply)

  test(`[${fx.name}] identidad y versión del contrato`, () => {
    const { provider, ctx } = okDeps()
    assert.equal(provider.id, fx.name)
    assert.equal(provider.contractVersion, CONTRACT_VERSION)
    assert.equal(ctx.provider, fx.name)
    assert.match(ctx.phone, /^\+[1-9][0-9]{6,14}$/)
  })

  test(`[${fx.name}] parseSecret rechaza secretos de otro proveedor`, () => {
    const { provider } = okDeps()
    assert.equal(provider.parseSecret({ provider: "otro" }), null)
    assert.equal(provider.parseSecret({}), null)
  })

  test(`[${fx.name}] capacidades completas y coherentes`, () => {
    const { provider, ctx } = okDeps()
    const caps = provider.capabilities(ctx)
    for (const k of ["coexistence", "historyImport", "templates", "media", "interactive", "readReceipts", "statusWebhooks"]) {
      assert.equal(typeof caps[k], "boolean", k)
    }
    assert.ok(Number.isInteger(caps.maxTextChars) && caps.maxTextChars >= 1000)
  })

  test(`[${fx.name}] webhook: acepta la firma válida y rechaza la alterada o ausente`, async () => {
    const { provider, ctx } = okDeps()
    assert.equal(await provider.verifyWebhook(await fx.inbound(), ctx), true)
    assert.equal(await provider.verifyWebhook(await fx.tampered(), ctx), false)
    assert.equal(await provider.verifyWebhook(await fx.unsigned(), ctx), false)
    assert.equal(await provider.verifyWebhook(await fx.inbound(), null), false)
  })

  test(`[${fx.name}] webhook: un mensaje entrante sale normalizado`, async () => {
    const { provider, ctx } = okDeps()
    const parsed = await provider.parseWebhook(await fx.inbound(), ctx)
    const inbound = parsed.events.filter((e) => e.type === "message.inbound")
    assert.equal(inbound.length, 1)
    const ev = inbound[0]
    assert.equal(ev.from, CUSTOMER)
    assert.ok(ev.providerMessageId.length > 0)
    assert.equal(ev.name, "Ana Pérez")
    assert.ok(ev.text.startsWith("Hola"))
    assert.ok(Array.isArray(ev.media))
    assert.ok(!Number.isNaN(Date.parse(ev.at)))
    assert.ok(["api", "history"].includes(ev.source))
  })

  test(`[${fx.name}] webhook: lo que no entiende no lanza ni crea mensajes`, async () => {
    const { provider, ctx } = okDeps()
    const parsed = await provider.parseWebhook(await fx.junk(), ctx)
    assert.equal(parsed.events.filter((e) => e.type === "message.inbound").length, 0)
    const broken = await provider.parseWebhook({ rawBody: "%%%{not", headers: new Headers(), url: "https://x" }, ctx)
    assert.equal(broken.events.filter((e) => e.type === "message.inbound").length, 0)
  })

  test(`[${fx.name}] webhookAck es un 200`, () => {
    const { provider } = okDeps()
    const ack = provider.webhookAck()
    assert.equal(ack.status, 200)
    assert.equal(typeof ack.body, "string")
  })

  test(`[${fx.name}] send correcto devuelve el identificador del proveedor`, async () => {
    const { provider, ctx } = okDeps()
    const r = await provider.send(ctx, { kind: "text", to: CUSTOMER, text: "Gracias, te confirmo el turno.", idempotencyKey: "k1" })
    assert.equal(r.ok, true)
    assert.ok(r.providerMessageId.length > 0)
  })

  for (const [kind, reply] of Object.entries(fx.errorReplies)) {
    test(`[${fx.name}] send no lanza y normaliza el error «${kind}»`, async () => {
      const { provider, ctx } = fx.make(reply)
      const r = await provider.send(ctx, { kind: "text", to: CUSTOMER, text: "Hola", idempotencyKey: "k2" })
      assert.equal(r.ok, false)
      assert.equal(r.error.kind, kind)
      assert.ok(ERROR_KINDS.includes(r.error.kind))
      assert.equal(typeof r.error.code, "string")
      assert.ok(r.error.message.length > 0)
      // Nunca se filtran credenciales en el mensaje para el usuario.
      for (const v of Object.values(ctx.credentials)) assert.ok(!r.error.message.includes(v))
      if (kind === "rate_limited" && fx.name === "twilio") assert.equal(r.error.retryAfterSec, 7)
    })
  }
}

test("[twilio] envía desde el número conectado, al destino, con Basic auth", async () => {
  const { provider, ctx, calls } = twilioFixture.make(twilioFixture.okReply)
  await provider.send(ctx, { kind: "text", to: CUSTOMER, text: "Hola", idempotencyKey: "k3" })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`)
  const form = new URLSearchParams(calls[0].init.body)
  assert.equal(form.get("From"), "whatsapp:+14155238886")
  assert.equal(form.get("To"), `whatsapp:${CUSTOMER}`)
  assert.equal(form.get("Body"), "Hola")
  assert.equal(calls[0].init.headers.Authorization, `Basic ${btoa(`${TW_SID}:${TW_TOKEN}`)}`)
})

test("[twilio] el aviso de otra cuenta se rechaza aunque la firma sea válida", async () => {
  const { provider, ctx } = twilioFixture.make(twilioFixture.okReply)
  const params = { MessageSid: "SM0123456789abcdef0123456789abcdef", AccountSid: "AC" + "1".repeat(32), From: `whatsapp:${CUSTOMER}`, Body: "Hola" }
  assert.equal(await provider.verifyWebhook(twilioRaw(params), ctx), false)
})

test("[twilio] adjuntos, ubicación y avisos de estado", async () => {
  const { provider, ctx } = twilioFixture.make(twilioFixture.okReply)
  const media = await provider.parseWebhook(
    twilioRaw({ MessageSid: "MM0123456789abcdef0123456789abcdef", AccountSid: TW_SID, From: `whatsapp:${CUSTOMER}`, Body: "", NumMedia: "2", MediaContentType0: "image/jpeg", MediaUrl0: "https://x/0", MediaUrl1: "https://x/1", Latitude: "-34.6", Longitude: "-58.4" }),
    ctx,
  )
  assert.equal(media.events[0].type, "message.inbound")
  assert.equal(media.events[0].media.length, 2)
  assert.deepEqual(media.events[0].location, { lat: -34.6, lng: -58.4 })

  const status = await provider.parseWebhook(twilioRaw({ MessageSid: "SM0123456789abcdef0123456789abcdef", AccountSid: TW_SID, MessageStatus: "undelivered", ErrorCode: "63016" }), ctx)
  assert.deepEqual(
    status.events.map((e) => [e.type, e.status, e.errorCode]),
    [["message.status", "failed", "63016"]],
  )
})
