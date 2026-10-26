// WhatsApp a través de Twilio (proveedor oficial de WhatsApp). Sirve tanto
// para el entorno de pruebas de Twilio (número compartido +14155238886) como
// para un número propio aprobado en Twilio. Más adelante, la conexión directa
// con Meta (Cloud API) puede ser otro proveedor de este mismo canal.
//
// Secreto en Vault (integrations, provider "whatsapp"):
//   { provider: "twilio", account_sid, auth_token, from }   from = +14155238886
//
// Reglas de WhatsApp: se puede contestar con texto libre durante las 24 h
// siguientes al último mensaje del cliente. Fuera de esa ventana solo se
// pueden enviar plantillas aprobadas (aún no incluidas).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

export type WhatsAppSecret = { provider: "twilio"; account_sid: string; auth_token: string; from: string }

export const ACCOUNT_SID_RE = /^AC[0-9a-f]{32}$/
export const AUTH_TOKEN_RE = /^[0-9a-f]{32}$/
export const PHONE_RE = /^\+[1-9][0-9]{6,14}$/
export const SANDBOX_NUMBER = "+14155238886"
export const WINDOW_MS = 24 * 3_600_000
// Twilio corta el texto de WhatsApp en 1600 caracteres.
export const MAX_WHATSAPP_CHARS = 1600

export class WhatsAppError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export function parseWhatsAppSecret(raw: string | null | undefined): WhatsAppSecret | null {
  try {
    const s = JSON.parse(raw ?? "") as Partial<WhatsAppSecret>
    if (s.provider === "twilio" && typeof s.account_sid === "string" && typeof s.auth_token === "string" && typeof s.from === "string") {
      return s as WhatsAppSecret
    }
  } catch {
    // formato no válido
  }
  return null
}

// "whatsapp:+34600111222" → "+34600111222" (o null si no es un número válido).
export function phoneOf(address: string | null | undefined): string | null {
  const p = (address ?? "").replace(/^whatsapp:/, "").trim()
  return PHONE_RE.test(p) ? p : null
}

function basic(sid: string, token: string) {
  return `Basic ${btoa(`${sid}:${token}`)}`
}

async function twilio<T>(secret: { account_sid: string; auth_token: string }, path: string, form?: Record<string, string>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${secret.account_sid}${path}`, {
      method: form ? "POST" : "GET",
      headers: {
        Authorization: basic(secret.account_sid, secret.auth_token),
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form ? new URLSearchParams(form) : undefined,
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new WhatsAppError("unavailable", "Twilio no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as T & { code?: number; message?: string }
  if (!res.ok) {
    if (res.status === 401 || res.status === 404) throw new WhatsAppError("invalid_credentials", "Twilio no reconoce el Account SID o el Auth Token.")
    // Errores habituales de WhatsApp en Twilio.
    if (data.code === 63015) throw new WhatsAppError("not_in_sandbox", "Ese número no se ha unido al entorno de pruebas de Twilio (tiene que enviar «join …» primero).")
    if (data.code === 63016) throw new WhatsAppError("outside_window", "Han pasado más de 24 horas desde su último mensaje: WhatsApp solo permite plantillas aprobadas.")
    if (data.code === 21211 || data.code === 21614) throw new WhatsAppError("bad_number", "El número de destino no es válido para WhatsApp.")
    if (data.code === 21606 || data.code === 63007) throw new WhatsAppError("bad_sender", "El número remitente no está habilitado para WhatsApp en tu cuenta de Twilio.")
    throw new WhatsAppError("api_error", `Twilio devolvió un error: ${String(data.message ?? res.status).slice(0, 200)}`)
  }
  return data
}

export async function verifyTwilio(accountSid: string, authToken: string): Promise<{ friendly_name: string; status: string }> {
  const acc = await twilio<{ friendly_name?: string; status?: string }>({ account_sid: accountSid, auth_token: authToken }, ".json")
  if (acc.status && acc.status !== "active") throw new WhatsAppError("inactive", "La cuenta de Twilio no está activa.")
  return { friendly_name: acc.friendly_name ?? "", status: acc.status ?? "active" }
}

export async function sendWhatsApp(secret: WhatsAppSecret, to: string, text: string): Promise<string> {
  if (!PHONE_RE.test(to)) throw new WhatsAppError("bad_number", "El número de destino no es válido para WhatsApp.")
  const body = text.trim()
  if (!body) throw new WhatsAppError("empty", "Falta el texto del mensaje.")
  if (body.length > MAX_WHATSAPP_CHARS) throw new WhatsAppError("too_long", `El mensaje pasa de ${MAX_WHATSAPP_CHARS} caracteres.`)
  const msg = await twilio<{ sid: string }>(secret, "/Messages.json", { From: `whatsapp:${secret.from}`, To: `whatsapp:${to}`, Body: body })
  return msg.sid
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

export async function whatsappSecret(admin: SupabaseClient, workspaceId: string): Promise<{ secret: WhatsAppSecret; integrationId: string } | null> {
  const { data: integ } = await admin.from("integrations").select("id, status").eq("workspace_id", workspaceId).eq("provider", "whatsapp").maybeSingle()
  if (integ?.status !== "active") return null
  const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "whatsapp" })
  const secret = parseWhatsAppSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
  return secret ? { secret, integrationId: integ.id } : null
}
