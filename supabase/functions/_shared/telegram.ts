// Cliente mínimo de la Bot API de Telegram. El token del bot vive en Vault:
//   { bot_token, secret_token }
// secret_token es el valor que Telegram envía en la cabecera
// X-Telegram-Bot-Api-Secret-Token de cada aviso al webhook.

export type TelegramSecret = { bot_token: string; secret_token: string }

export class TelegramError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export const BOT_TOKEN_RE = /^[0-9]{5,15}:[A-Za-z0-9_-]{30,60}$/

export function parseTelegramSecret(raw: string | null | undefined): TelegramSecret | null {
  try {
    const s = JSON.parse(raw ?? "") as Partial<TelegramSecret>
    if (typeof s.bot_token === "string" && typeof s.secret_token === "string") return s as TelegramSecret
  } catch {
    // formato no válido
  }
  return null
}

async function call<T>(token: string, method: string, params: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(20_000),
    })
  } catch {
    throw new TelegramError("unavailable", "Telegram no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; error_code?: number }
  if (!data.ok) {
    if (data.error_code === 401 || data.error_code === 404) throw new TelegramError("invalid_token", "Telegram no reconoce el token del bot.")
    if (data.error_code === 403) throw new TelegramError("blocked", "El destinatario ha bloqueado al bot o nunca le ha escrito.")
    throw new TelegramError("api_error", `Telegram devolvió un error: ${String(data.description ?? res.status).slice(0, 200)}`)
  }
  return data.result as T
}

export function getMe(token: string) {
  return call<{ id: number; username?: string; first_name?: string }>(token, "getMe")
}

// Versión de la suscripción del webhook. Al subirla, runs-cron vuelve a
// registrar los webhooks existentes (ver upgradeTelegramWebhooks).
export const WEBHOOK_VERSION = 2
export const ALLOWED_UPDATES = ["message", "edited_message", "callback_query"]

export function setWebhook(token: string, url: string, secretToken: string, dropPending = true) {
  return call<boolean>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ALLOWED_UPDATES,
    drop_pending_updates: dropPending,
  })
}

export function deleteWebhook(token: string) {
  return call<boolean>(token, "deleteWebhook", { drop_pending_updates: false })
}

export type InlineButton = { text: string; callback_data: string }
export type InlineKeyboard = InlineButton[][]

export async function sendTelegram(token: string, chatId: string, text: string, keyboard?: InlineKeyboard): Promise<number> {
  const msg = await call<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...(keyboard?.length ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  })
  return msg.message_id
}

// Cambia el texto de un mensaje enviado por el bot y quita sus botones.
export function editTelegram(token: string, chatId: string, messageId: number, text: string) {
  return call<unknown>(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [] },
  })
}

// Respuesta obligatoria a la pulsación de un botón (quita el «cargando»).
export function answerCallback(token: string, callbackId: string, text?: string) {
  return call<boolean>(token, "answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text: text.slice(0, 200) } : {}) })
}

// «Escribiendo…» en el chat mientras se prepara la respuesta.
export function sendTyping(token: string, chatId: string) {
  return call<boolean>(token, "sendChatAction", { chat_id: chatId, action: "typing" })
}

// Descarga un archivo enviado al bot (p. ej. una nota de voz), con límite de tamaño.
export async function downloadTelegramFile(token: string, fileId: string, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const file = await call<{ file_path?: string; file_size?: number }>(token, "getFile", { file_id: fileId })
  if (!file.file_path) throw new TelegramError("api_error", "Telegram no devolvió el archivo.")
  if ((file.file_size ?? 0) > maxBytes) throw new TelegramError("too_large", "El archivo es demasiado grande.")
  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) })
  } catch {
    throw new TelegramError("unavailable", "Telegram no respondió a tiempo.")
  }
  if (!res.ok) throw new TelegramError("api_error", "No se pudo descargar el archivo de Telegram.")
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > maxBytes) throw new TelegramError("too_large", "El archivo es demasiado grande.")
  return bytes
}
