// Cliente mínimo de Google (OAuth, Drive y Sheets) para las Edge Functions.
// Nunca registra tokens. El refresh token vive en Vault; el access token
// solo existe en memoria durante la petición.

export const GOOGLE_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"]
export const SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet"

export class GoogleError extends Error {
  constructor(public code: "invalid_grant" | "not_found" | "forbidden" | "bad_request" | "unavailable", message: string) {
    super(message)
  }
}

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable ${name}`)
  return value
}

export function googleConfigured(): boolean {
  return Boolean(Deno.env.get("GOOGLE_CLIENT_ID") && Deno.env.get("GOOGLE_CLIENT_SECRET") && Deno.env.get("DELEGA_SITE_URL"))
}

export function redirectUri(): string {
  return `${env("DELEGA_SITE_URL").replace(/\/+$/, "")}/integraciones/google/callback`
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

export function authorizationUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
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
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw new GoogleError("invalid_grant", "Google ha revocado el acceso.")
    throw new GoogleError("bad_request", "Google rechazó la autorización.")
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
