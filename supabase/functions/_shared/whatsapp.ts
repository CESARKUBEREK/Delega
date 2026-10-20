// Cliente mínimo de la API oficial de WhatsApp Business (Cloud API de Meta).
// Dos modos de conexión por espacio:
//   * "embedded": alta con Embedded Signup en la app de Delega (Tech Provider),
//     también en coexistencia con la app WhatsApp Business. Vault guarda
//     { access_token, mode: "embedded" }; el webhook es el central de Delega.
//   * "manual": app de Meta propia del espacio. Vault guarda
//     { access_token, app_secret, verify_token, mode: "manual" }.
// La configuración pública va en integrations.config:
//   { phone_number_id, waba_id, display_phone_number, verified_name, mode,
//     coexistence, categories, retention_days }

export const GRAPH = "https://graph.facebook.com/v26.0"

export type WhatsAppSecret = { access_token: string; app_secret?: string; verify_token?: string; mode?: "manual" | "embedded" }
export type WhatsAppConfig = {
  phone_number_id: string
  waba_id?: string
  display_phone_number?: string | null
  verified_name?: string | null
  mode?: "manual" | "embedded"
  coexistence?: boolean
  categories?: string[]
  retention_days?: number | null
}

export const DEFAULT_CATEGORIES = ["Cliente", "Proveedor", "Obra o proyecto", "Administración", "Personal", "Publicidad", "Otros"]

export class WhatsAppError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export function parseSecret(raw: string | null | undefined): WhatsAppSecret | null {
  try {
    const s = JSON.parse(raw ?? "") as Partial<WhatsAppSecret>
    if (typeof s.access_token === "string") return s as WhatsAppSecret
  } catch {
    // formato no válido
  }
  return null
}

async function graph<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${GRAPH}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new WhatsAppError("unavailable", "WhatsApp no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number } }
  if (!res.ok) {
    const code = data?.error?.code
    // 131047: han pasado más de 24 h desde el último mensaje del destinatario.
    if (code === 131047) {
      throw new WhatsAppError("window_closed", "Han pasado más de 24 h desde el último mensaje de esa persona: hay que usar una plantilla aprobada.")
    }
    if (res.status === 401 || code === 190) throw new WhatsAppError("invalid_token", "Meta rechazó el token de acceso de WhatsApp.")
    const detail = data?.error?.message ? `: ${String(data.error.message).slice(0, 200)}` : ""
    throw new WhatsAppError(code ? `api_${code}` : "api_error", `WhatsApp devolvió un error${detail}`)
  }
  return data
}

export function phoneInfo(token: string, phoneNumberId: string) {
  return graph<{ display_phone_number?: string; verified_name?: string; id: string }>(
    token,
    `${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`,
  )
}

type SendResult = { messages?: { id: string }[] }

export async function sendText(token: string, phoneNumberId: string, to: string, body: string): Promise<string | null> {
  const data = await graph<SendResult>(token, `${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4096) },
    }),
  })
  return data.messages?.[0]?.id ?? null
}

export async function sendTemplate(
  token: string,
  phoneNumberId: string,
  to: string,
  name: string,
  language: string,
  parameters: string[],
): Promise<string | null> {
  const data = await graph<SendResult>(token, `${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name,
        language: { code: language },
        components: parameters.length
          ? [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text: text.slice(0, 1000) })) }]
          : [],
      },
    }),
  })
  return data.messages?.[0]?.id ?? null
}

// ---------------------------------------------------------------------------
// Webhook: firma X-Hub-Signature-256 (HMAC-SHA256 del cuerpo con el secreto de la app)
// ---------------------------------------------------------------------------
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function validSignature(appSecret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)))
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("")
  return timingSafeEqual(hex, header.slice(7).toLowerCase())
}

export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(a, b)
}

export function normalizePhone(value: string): string {
  return value.replace(/[^0-9]/g, "")
}

// ---------------------------------------------------------------------------
// Embedded Signup (app de Delega como Tech Provider)
// ---------------------------------------------------------------------------
export function metaPlatform(): { appId: string; appSecret: string; verifyToken: string } | null {
  const appId = Deno.env.get("META_APP_ID")
  const appSecret = Deno.env.get("META_APP_SECRET")
  const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")
  return appId && appSecret && verifyToken ? { appId, appSecret, verifyToken } : null
}

export async function exchangeSignupCode(code: string): Promise<string> {
  const platform = metaPlatform()
  if (!platform) throw new WhatsAppError("not_configured", "La app de Meta de Delega aún no está configurada en el servidor.")
  const params = new URLSearchParams({ client_id: platform.appId, client_secret: platform.appSecret, code })
  let res: Response
  try {
    res = await fetch(`${GRAPH}/oauth/access_token?${params}`, { signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new WhatsAppError("unavailable", "Meta no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } }
  if (!res.ok || !data.access_token) throw new WhatsAppError("exchange_failed", "Meta no aceptó el código de alta. Vuelve a intentarlo.")
  return data.access_token
}

export async function listPhoneNumbers(token: string, wabaId: string) {
  const data = await graph<{
    data?: { id: string; display_phone_number?: string; verified_name?: string; is_on_biz_app?: boolean; platform_type?: string }[]
  }>(token, `${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,is_on_biz_app,platform_type`)
  return data.data ?? []
}

export async function subscribeApp(token: string, wabaId: string): Promise<void> {
  await graph(token, `${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST", body: "{}" })
}

// Coexistencia: pide a Meta los contactos y el histórico (6 meses, una sola vez).
// El código 135000 significa que ya se había pedido: no es un error.
export async function requestSync(token: string, phoneNumberId: string, syncType: "smb_app_state_sync" | "history"): Promise<void> {
  try {
    await graph(token, `${encodeURIComponent(phoneNumberId)}/smb_app_data`, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", sync_type: syncType }),
    })
  } catch (e) {
    if (e instanceof WhatsAppError && e.code === "api_135000") return
    throw e
  }
}
