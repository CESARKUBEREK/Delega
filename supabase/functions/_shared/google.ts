// Cliente mínimo de Google (OAuth, Drive, Sheets y Docs) para las Edge Functions.
// Nunca registra tokens. El refresh token vive en Vault; el access token
// solo existe en memoria durante la petición.

export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"]
export const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet"

export class GoogleError extends Error {
  constructor(
    public code: "invalid_grant" | "invalid_client" | "not_found" | "forbidden" | "bad_request" | "unavailable",
    message: string,
  ) {
    super(message)
  }
}

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable ${name}`)
  return value
}

export function googleConfigured(): boolean {
  return Boolean(Deno.env.get("GOOGLE_CLIENT_ID") && Deno.env.get("GOOGLE_CLIENT_SECRET"))
}

// Dirección pública de la app. Debe coincidir con la URI de redirección
// registrada en el cliente OAuth de Google.
const SITE_URL = (Deno.env.get("DELEGA_SITE_URL") ?? "https://delega-five.vercel.app").replace(/\/+$/, "")

export function redirectUri(): string {
  return `${SITE_URL}/integraciones/google/callback`
}

// ---------------------------------------------------------------------------
// PKCE y estado
// ---------------------------------------------------------------------------
function base64url(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))
  return base64url(digest)
}

export function authorizationUrl(state: string, challenge: string, scopes: string[] = GOOGLE_SCOPES): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  id_token?: string
  error?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  let res: Response
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), ...body }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new GoogleError("unavailable", "No se pudo contactar con Google.")
  }
  const data = (await res.json().catch(() => ({}))) as TokenResponse & { error_description?: string }
  if (!res.ok || !data.access_token) {
    // Solo se registra el código de error de Google, nunca tokens.
    console.error("google_token_error", data.error ?? res.status)
    if (data.error === "invalid_grant") throw new GoogleError("invalid_grant", "Google ha revocado el acceso.")
    if (data.error === "invalid_client" || data.error === "unauthorized_client") {
      throw new GoogleError("invalid_client", "Google no reconoce el ID o el secreto del cliente OAuth configurados en el servidor.")
    }
    throw new GoogleError("bad_request", `Google rechazó la autorización (${String(data.error ?? res.status).slice(0, 60)}).`)
  }
  return data
}

export function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  return tokenRequest({ code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: redirectUri() })
}

export async function accessTokenFrom(refreshToken: string): Promise<{ token: string; expiresIn: number }> {
  const data = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" })
  return { token: data.access_token!, expiresIn: data.expires_in ?? 3600 }
}

export async function revokeToken(token: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined)
}

// El id_token llega directamente de Google por TLS: basta con leer el correo.
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { email?: string }
    return typeof payload.email === "string" ? payload.email.slice(0, 320) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Drive y Sheets
// ---------------------------------------------------------------------------
async function googleFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new GoogleError("unavailable", "Google no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) {
    const detail = data?.error?.message ? `: ${String(data.error.message).slice(0, 200)}` : ""
    if (res.status === 404) throw new GoogleError("not_found", `No se encontró la planilla o el rango${detail}`)
    if (res.status === 401 || res.status === 403) throw new GoogleError("forbidden", `Google denegó el acceso${detail}`)
    if (res.status === 400) throw new GoogleError("bad_request", `Petición no válida${detail}`)
    throw new GoogleError("unavailable", `Error de Google (${res.status})${detail}`)
  }
  return data
}

export type DriveFile = { id: string; name: string; mimeType: string; webViewLink?: string }

export function driveFile(token: string, fileId: string): Promise<DriveFile> {
  return googleFetch<DriveFile>(
    token,
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`,
  )
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets"

export type SheetInfo = { title: string; sheets: { title: string; rows: number; columns: number }[] }

export async function spreadsheetInfo(token: string, fileId: string): Promise<SheetInfo> {
  const data = await googleFetch<{
    properties?: { title?: string }
    sheets?: { properties?: { title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[]
  }>(token, `${SHEETS}/${encodeURIComponent(fileId)}?fields=properties.title,sheets.properties(title,gridProperties(rowCount,columnCount))`)
  return {
    title: data.properties?.title ?? "",
    sheets: (data.sheets ?? []).map((s) => ({
      title: s.properties?.title ?? "",
      rows: s.properties?.gridProperties?.rowCount ?? 0,
      columns: s.properties?.gridProperties?.columnCount ?? 0,
    })),
  }
}

export type Cell = string | number | boolean | null

export async function readRange(token: string, fileId: string, range: string): Promise<{ range: string; values: Cell[][] }> {
  const data = await googleFetch<{ range?: string; values?: Cell[][] }>(
    token,
    `${SHEETS}/${encodeURIComponent(fileId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`,
  )
  return { range: data.range ?? range, values: data.values ?? [] }
}

// Se escribe en modo RAW: el texto no se interpreta como fórmula.
export async function appendRows(token: string, fileId: string, range: string, values: Cell[][]) {
  const data = await googleFetch<{ updates?: { updatedRange?: string; updatedRows?: number; updatedCells?: number } }>(
    token,
    `${SHEETS}/${encodeURIComponent(fileId)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values }) },
  )
  return { updatedRange: data.updates?.updatedRange ?? range, updatedRows: data.updates?.updatedRows ?? 0, updatedCells: data.updates?.updatedCells ?? 0 }
}

export async function updateRange(token: string, fileId: string, range: string, values: Cell[][]) {
  const data = await googleFetch<{ updatedRange?: string; updatedRows?: number; updatedCells?: number }>(
    token,
    `${SHEETS}/${encodeURIComponent(fileId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { method: "PUT", body: JSON.stringify({ values }) },
  )
  return { updatedRange: data.updatedRange ?? range, updatedRows: data.updatedRows ?? 0, updatedCells: data.updatedCells ?? 0 }
}

// ---------------------------------------------------------------------------
// Google Docs
// ---------------------------------------------------------------------------
export const DOCUMENT_MIME = "application/vnd.google-apps.document"
const DOCS = "https://docs.googleapis.com/v1/documents"

type DocElement = {
  paragraph?: { elements?: { textRun?: { content?: string } }[] }
  table?: { tableRows?: { tableCells?: { content?: DocElement[] }[] }[] }
}

function docText(content: DocElement[] | undefined, out: string[]) {
  for (const el of content ?? []) {
    if (el.paragraph) out.push((el.paragraph.elements ?? []).map((e) => e.textRun?.content ?? "").join(""))
    if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        const cells = (row.tableCells ?? []).map((c) => {
          const inner: string[] = []
          docText(c.content, inner)
          return inner.join(" ").replace(/\s+/g, " ").trim()
        })
        out.push(`| ${cells.join(" | ")} |\n`)
      }
    }
  }
}

export async function readDocument(token: string, docId: string): Promise<{ title: string; text: string }> {
  const data = await googleFetch<{ title?: string; body?: { content?: DocElement[] } }>(
    token,
    `${DOCS}/${encodeURIComponent(docId)}?fields=title,body.content`,
  )
  const out: string[] = []
  docText(data.body?.content, out)
  return { title: data.title ?? "", text: out.join("") }
}

export async function appendToDocument(token: string, docId: string, text: string): Promise<void> {
  await googleFetch(token, `${DOCS}/${encodeURIComponent(docId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ insertText: { endOfSegmentLocation: {}, text: `\n${text}` } }] }),
  })
}

export async function createDocument(token: string, title: string, text: string, parentId?: string | null): Promise<{ id: string; url: string }> {
  // Se crea con Drive (para poder elegir carpeta) y se rellena con Docs.
  const doc = await googleFetch<{ id: string }>(token, `${DRIVE}/files?fields=id&supportsAllDrives=true`, {
    method: "POST",
    body: JSON.stringify({ name: title, mimeType: DOCUMENT_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  })
  if (text) {
    await googleFetch(token, `${DOCS}/${encodeURIComponent(doc.id)}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ insertText: { endOfSegmentLocation: {}, text } }] }),
    })
  }
  return { id: doc.id, url: `https://docs.google.com/document/d/${doc.id}/edit` }
}

// ---------------------------------------------------------------------------
// Google Drive: carpetas y archivos de cualquier tipo
// ---------------------------------------------------------------------------
const DRIVE = "https://www.googleapis.com/drive/v3"
export const FOLDER_MIME = "application/vnd.google-apps.folder"
const SLIDES_MIME = "application/vnd.google-apps.presentation"
const MAX_DOWNLOAD = 2_000_000

export type DriveEntry = { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; parents?: string[] }

// Con drive.file, Drive solo devuelve los archivos a los que Delega tiene acceso.
export async function listFolder(token: string, folderId: string, max = 100): Promise<DriveEntry[]> {
  const params = new URLSearchParams({
    q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,modifiedTime,size)",
    pageSize: String(Math.min(max, 200)),
    orderBy: "modifiedTime desc",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  })
  const data = await googleFetch<{ files?: DriveEntry[] }>(token, `${DRIVE}/files?${params}`)
  return data.files ?? []
}

export function driveEntry(token: string, fileId: string): Promise<DriveEntry> {
  return googleFetch<DriveEntry>(
    token,
    `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,size,parents&supportsAllDrives=true`,
  )
}

async function rawFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(45_000) })
  } catch {
    throw new GoogleError("unavailable", "Google no respondió a tiempo.")
  }
  if (!res.ok) {
    await res.body?.cancel()
    if (res.status === 404) throw new GoogleError("not_found", "No se encontró el archivo.")
    if (res.status === 401 || res.status === 403) throw new GoogleError("forbidden", "Google denegó el acceso al archivo.")
    throw new GoogleError("unavailable", `Error de Google (${res.status}).`)
  }
  return res
}

async function exportText(token: string, fileId: string, mime: string): Promise<string> {
  const res = await rawFetch(token, `${DRIVE}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(mime)}`)
  return (await res.text()).slice(0, MAX_DOWNLOAD)
}

// Convierte una copia temporal a formato de Google, exporta el texto y la borra.
async function convertAndExport(token: string, fileId: string, target: string, exportMime: string): Promise<string> {
  const copy = await googleFetch<{ id: string }>(token, `${DRIVE}/files/${encodeURIComponent(fileId)}/copy?fields=id&supportsAllDrives=true`, {
    method: "POST",
    body: JSON.stringify({ mimeType: target, name: "delega-lectura-temporal" }),
  })
  try {
    return await exportText(token, copy.id, exportMime)
  } finally {
    await rawFetch(token, `${DRIVE}/files/${encodeURIComponent(copy.id)}?supportsAllDrives=true`, { method: "DELETE" }).catch(() => undefined)
  }
}

const TO_DOC = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/html",
]
const TO_SHEET = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
]
const TO_SLIDES = ["application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]

// Texto de cualquier archivo legible: formatos de Google, Office, PDF y texto.
export async function readDriveText(token: string, file: { id: string; mimeType: string }): Promise<string> {
  const m = file.mimeType
  if (m === DOCUMENT_MIME) return (await readDocument(token, file.id)).text
  if (m === SPREADSHEET_MIME) return await exportText(token, file.id, "text/csv")
  if (m === SLIDES_MIME) return await exportText(token, file.id, "text/plain")
  if (TO_DOC.includes(m)) return await convertAndExport(token, file.id, DOCUMENT_MIME, "text/plain")
  if (TO_SHEET.includes(m)) return await convertAndExport(token, file.id, SPREADSHEET_MIME, "text/csv")
  if (TO_SLIDES.includes(m)) return await convertAndExport(token, file.id, SLIDES_MIME, "text/plain")
  if (m.startsWith("text/") || m === "application/json" || m === "application/xml") {
    const res = await rawFetch(token, `${DRIVE}/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`)
    return (await res.text()).slice(0, MAX_DOWNLOAD)
  }
  throw new GoogleError("bad_request", "Orkesta aún no sabe leer este tipo de archivo (imágenes, vídeos, planos CAD…).")
}

// Archivo de texto nuevo (txt o csv) dentro de una carpeta.
export async function createTextFile(token: string, name: string, text: string, mime: "text/plain" | "text/csv", parentId?: string | null) {
  const boundary = `delega${crypto.randomUUID().replace(/-/g, "")}`
  const meta = JSON.stringify({ name, mimeType: mime, ...(parentId ? { parents: [parentId] } : {}) })
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`
  const res = await rawFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  })
  const data = (await res.json()) as { id: string; webViewLink?: string }
  return { id: data.id, url: data.webViewLink ?? `https://drive.google.com/file/d/${data.id}/view` }
}
