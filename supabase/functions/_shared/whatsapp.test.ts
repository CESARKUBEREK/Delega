// deno test -A _shared/whatsapp.test.ts
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert"
import { createHmac } from "node:crypto"
import { parseWhatsAppSecret, phoneOf, twilioSignature, validTwilioSignature } from "./whatsapp.ts"

// Implementación de referencia, independiente (la de los SDK de Twilio):
// URL + claves ordenadas con su valor, HMAC-SHA1 con el Auth Token, base64.
function reference(token: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("")
  return createHmac("sha1", token).update(data, "utf8").digest("base64")
}

const TOKEN = "0123456789abcdef0123456789abcdef"
const URL_ = "https://xgbmpziocflgsszzgyeb.supabase.co/functions/v1/whatsapp-webhook?c=11111111-2222-3333-4444-555555555555"
const PARAMS = {
  SmsMessageSid: "SM0123456789abcdef0123456789abcdef",
  NumMedia: "0",
  ProfileName: "Ana Pérez",
  Body: "Hola, ¿tenéis cita el lunes? 👍",
  To: "whatsapp:+14155238886",
  From: "whatsapp:+34600111222",
  // Identificador inventado, generado aquí para que no parezca una credencial real.
  AccountSid: "AC" + "0".repeat(32),
  MessageSid: "SM0123456789abcdef0123456789abcdef",
  WaId: "34600111222",
}

Deno.test("la firma coincide con la de referencia (con acentos y emojis)", async () => {
  assertEquals(await twilioSignature(TOKEN, URL_, Object.entries(PARAMS)), reference(TOKEN, URL_, PARAMS))
})

Deno.test("el orden de llegada de los parámetros no importa", async () => {
  const shuffled = Object.entries(PARAMS).reverse()
  assert(await validTwilioSignature(TOKEN, URL_, shuffled, reference(TOKEN, URL_, PARAMS)))
})

Deno.test("se rechaza si cambia el texto, la URL, el token o falta la firma", async () => {
  const sig = reference(TOKEN, URL_, PARAMS)
  assert(!(await validTwilioSignature(TOKEN, URL_, Object.entries({ ...PARAMS, Body: "Otro texto" }), sig)))
  assert(!(await validTwilioSignature(TOKEN, URL_.replace("5555", "6666"), Object.entries(PARAMS), sig)))
  assert(!(await validTwilioSignature("f".repeat(32), URL_, Object.entries(PARAMS), sig)))
  assert(!(await validTwilioSignature(TOKEN, URL_, Object.entries(PARAMS), "")))
})

Deno.test("números de WhatsApp", () => {
  assertEquals(phoneOf("whatsapp:+34600111222"), "+34600111222")
  assertEquals(phoneOf("+5491122334455"), "+5491122334455")
  assertEquals(phoneOf("whatsapp:34600111222"), null)
  assertEquals(phoneOf("whatsapp:+34 600"), null)
  assertEquals(phoneOf(null), null)
})

Deno.test("secreto guardado", () => {
  assert(parseWhatsAppSecret(JSON.stringify({ provider: "twilio", account_sid: "AC1", auth_token: "t", from: "+14155238886" })))
  assertEquals(parseWhatsAppSecret(JSON.stringify({ provider: "meta", token: "x" })), null)
  assertEquals(parseWhatsAppSecret("no json"), null)
})
