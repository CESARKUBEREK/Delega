// Cliente mínimo de la API de Gmail. Usa el access token obtenido del refresh
// token del espacio (provider "gmail"); nunca registra tokens ni contenidos.
import { GoogleError } from "./google.ts"

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
]
const API = "https://gmail.googleapis.com/gmail/v1/users/me"

async function gmail<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new GoogleError("unavailable", "Gmail no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) {
    if (res.status === 404) throw new GoogleError("not_found", "Gmail no encontró el mensaje o el historial.")
    if (res.status === 401 || res.status === 403) throw new GoogleError("forbidden", "Gmail denegó el acceso.")
    throw new GoogleError("unavailable", `Error de Gmail (${res.status}).`)
  }
  return data
}

export function profile(token: string) {
  return gmail<{ emailAddress: string; historyId: string }>(token, "profile")
}

export async function listMessageIds(token: string, query: string, max: number): Promise<string[]> {
  const ids: string[] = []
  let pageToken = ""
  while (ids.length < max) {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(100, max - ids.length)) })
    if (pageToken) params.set("pageToken", pageToken)
    const data = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `messages?${params}`)
    ids.push(...(data.messages ?? []).map((m) => m.id))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return ids
}

// Mensajes añadidos desde un historyId. Si el historyId es demasiado antiguo,
// Gmail devuelve 404 y hay que volver a sincronizar desde cero.
export async function historyMessageIds(token: string, startHistoryId: string, max: number): Promise<{ ids: string[]; historyId: string | null }> {
  const ids: string[] = []
  let pageToken = ""
  let historyId: string | null = null
  while (ids.length < max) {
    const params = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", maxResults: "100" })
    if (pageToken) params.set("pageToken", pageToken)
    const data = await gmail<{ history?: { messagesAdded?: { message: { id: string; labelIds?: string[] } }[] }[]; historyId?: string; nextPageToken?: string }>(
      token,
      `history?${params}`,
    )
    historyId = data.historyId ?? historyId
    for (const h of data.history ?? []) {
      for (const a of h.messagesAdded ?? []) {
        const labels = a.message.labelIds ?? []
        if (labels.includes("SPAM") || labels.includes("DRAFT")) continue
        ids.push(a.message.id)
      }
    }
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return { ids: [...new Set(ids)].slice(0, max), historyId }
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; filename?: string }
type RawMessage = {
  id: string
  threadId: string
  labelIds?: string[]
  internalDate?: string
  snippet?: string
  payload?: Part & { headers?: { name: string; value: string }[] }
}

function decode(data: string | undefined): string {
  if (!data) return ""
  try {
    const bin = atob(data.replace(/-/g, "+").replace(/_/g, "/"))
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
  } catch {
    return ""
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
}

function findBody(part: Part | undefined): { text: string; attachments: string[] } {
  const attachments: string[] = []
  let plain = ""
  let html = ""
  const walk = (p: Part | undefined) => {
    if (!p) return
    if (p.filename) attachments.push(p.filename)
    if (p.mimeType === "text/plain" && !plain) plain = decode(p.body?.data)
    else if (p.mimeType === "text/html" && !html) html = decode(p.body?.data)
    for (const c of p.parts ?? []) walk(c)
  }
  walk(part)
  return { text: (plain || htmlToText(html)).trim(), attachments }
}

// Quita las citas del mensaje anterior para no repetir el hilo entero.
function stripQuoted(text: string): string {
  const lines = text.split("\n")
  const cut = lines.findIndex((l) => /^(El .+ escribió:|On .+ wrote:|-----Original Message-----|De: .+)$/.test(l.trim()))
  const kept = (cut > 0 ? lines.slice(0, cut) : lines).filter((l) => !l.startsWith(">"))
  return kept.join("\n").trim()
}

export function parseAddress(value: string): { name: string | null; address: string } {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim() || null, address: m[2].trim().toLowerCase() }
  return { name: null, address: value.trim().toLowerCase() }
}

export type ParsedMail = {
  id: string
  threadId: string
  from: { name: string | null; address: string }
  to: string
  subject: string
  date: string
  body: string
  messageId: string | null
  references: string | null
  outgoing: boolean
}

export async function getMessage(token: string, id: string, myAddress: string): Promise<ParsedMail> {
  const m = await gmail<RawMessage>(token, `messages/${encodeURIComponent(id)}?format=full`)
  const headers = new Map((m.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]))
  const from = parseAddress(headers.get("from") ?? "")
  const { text, attachments } = findBody(m.payload)
  const body = [stripQuoted(text) || m.snippet || "", attachments.length ? `[adjuntos: ${attachments.join(", ")}]` : ""]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 20_000)
  return {
    id: m.id,
    threadId: m.threadId,
    from,
    to: (headers.get("to") ?? "").slice(0, 2000),
    subject: (headers.get("subject") ?? "").slice(0, 300),
    date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString(),
    body,
    messageId: headers.get("message-id") ?? null,
    references: headers.get("references") ?? null,
    outgoing: (m.labelIds ?? []).includes("SENT") || from.address === myAddress.toLowerCase(),
  }
}

// ---------------------------------------------------------------------------
// Envío (RFC 2822 en base64url). Las cabeceras se limpian de saltos de línea.
// ---------------------------------------------------------------------------
function header(v: string): string {
  return v.replace(/[\r\n]+/g, " ").trim()
}

function encodeHeader(v: string): string {
  // Codificación MIME para asuntos con acentos.
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(v)))}?=`
}

function base64url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function sendMail(
  token: string,
  input: { from: string; to: string; subject: string; body: string; threadId?: string | null; inReplyTo?: string | null; references?: string | null },
): Promise<{ id: string; threadId: string }> {
  const lines = [
    `From: ${header(input.from)}`,
    `To: ${header(input.to)}`,
    `Subject: ${encodeHeader(header(input.subject))}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ]
  if (input.inReplyTo) lines.push(`In-Reply-To: ${header(input.inReplyTo)}`)
  if (input.inReplyTo || input.references) lines.push(`References: ${header([input.references, input.inReplyTo].filter(Boolean).join(" "))}`)
  const raw = base64url(`${lines.join("\r\n")}\r\n\r\n${input.body.replace(/\r?\n/g, "\r\n")}`)
  return await gmail<{ id: string; threadId: string }>(token, "messages/send", {
    method: "POST",
    body: JSON.stringify(input.threadId ? { raw, threadId: input.threadId } : { raw }),
  })
}
