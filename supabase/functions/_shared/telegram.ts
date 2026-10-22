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

export function setWebhook(token: string, url: string, secretToken: string) {
  return call<boolean>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: true,
  })
}

export function deleteWebhook(token: string) {
  return call<boolean>(token, "deleteWebhook", { drop_pending_updates: false })
}

export async function sendTelegram(token: string, chatId: string, text: string): Promise<number> {
  const msg = await call<{ message_id: number }>(token, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4096),
    link_preview_options: { is_disabled: true },
  })
  return msg.message_id
}
