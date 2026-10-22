// Cliente mínimo de Google Calendar. Usa el refresh token del espacio
// (provider "calendar"). Nunca registra tokens ni contenidos.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { accessTokenFrom, GoogleError } from "./google.ts"

export const CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
]
export const CALENDAR_REQUIRED = ["https://www.googleapis.com/auth/calendar.events"]
export const DEFAULT_TIMEZONE = "Europe/Madrid"
const API = "https://www.googleapis.com/calendar/v3"

async function cal<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new GoogleError("unavailable", "Google Calendar no respondió a tiempo.")
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!res.ok) {
    const detail = data?.error?.message ? `: ${String(data.error.message).slice(0, 200)}` : ""
    if (res.status === 404) throw new GoogleError("not_found", `No se encontró el evento o el calendario${detail}`)
    if (res.status === 401 || res.status === 403) throw new GoogleError("forbidden", `Google Calendar denegó el acceso${detail}`)
    if (res.status === 400) throw new GoogleError("bad_request", `Petición no válida${detail}`)
    throw new GoogleError("unavailable", `Error de Google Calendar (${res.status})${detail}`)
  }
  return data
}

export type CalendarConfig = { email?: string | null; timezone?: string }

// Access token de Calendar del espacio (o error claro si Google retiró el acceso).
export async function calendarToken(admin: SupabaseClient, workspaceId: string): Promise<{ token: string; config: CalendarConfig }> {
  const [{ data: secretRows }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "calendar" }),
    admin.from("integrations").select("status, config").eq("workspace_id", workspaceId).eq("provider", "calendar").maybeSingle(),
  ])
  const secret = secretRows?.[0] as { refresh_token: string } | undefined
  if (!secret || !integ) throw new GoogleError("not_found", "Google Calendar no está conectado.")
  if (integ.status !== "active") throw new GoogleError("invalid_grant", "Google retiró el acceso a Calendar. Vuelve a conectarlo.")
  try {
    const { token } = await accessTokenFrom(secret.refresh_token)
    return { token, config: (integ.config ?? {}) as CalendarConfig }
  } catch (e) {
    if (e instanceof GoogleError && e.code === "invalid_grant") {
      await admin.rpc("integration_mark_invalid", { p_workspace_id: workspaceId, p_provider: "calendar" })
      throw new GoogleError("invalid_grant", "Google retiró el acceso a Calendar. Vuelve a conectarlo.")
    }
    throw e
  }
}

export async function primaryTimezone(token: string): Promise<string | null> {
  try {
    const data = await cal<{ timeZone?: string }>(token, "calendars/primary")
    return data.timeZone ?? null
  } catch {
    return null
  }
}

export type EventSummary = {
  id: string
  title: string
  start: string
  end: string
  all_day: boolean
  location: string | null
  description: string | null
  attendees: string[]
  link: string | null
}

type RawEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  attendees?: { email?: string }[]
  status?: string
}

function summarize(e: RawEvent): EventSummary {
  return {
    id: e.id,
    title: e.summary ?? "(sin título)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    all_day: Boolean(e.start?.date),
    location: e.location ?? null,
    description: e.description ? e.description.slice(0, 1000) : null,
    attendees: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean).slice(0, 20),
    link: e.htmlLink ?? null,
  }
}

export async function listEvents(token: string, timeMin: string, timeMax: string, query: string | null, max = 50): Promise<EventSummary[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.min(max, 100)),
  })
  if (query) params.set("q", query)
  const data = await cal<{ items?: RawEvent[] }>(token, `calendars/primary/events?${params}`)
  return (data.items ?? []).filter((e) => e.status !== "cancelled").map(summarize)
}

export async function getEvent(token: string, eventId: string): Promise<EventSummary> {
  return summarize(await cal<RawEvent>(token, `calendars/primary/events/${encodeURIComponent(eventId)}`))
}

export type EventInput = {
  title?: string | null
  start?: string | null
  end?: string | null
  all_day?: boolean
  description?: string | null
  location?: string | null
  attendees?: string[]
}

// "2026-11-03" (todo el día) o "2026-11-03T10:00" / con zona.
function when(value: string, allDay: boolean, tz: string) {
  return allDay ? { date: value.slice(0, 10) } : { dateTime: value.length === 16 ? `${value}:00` : value, timeZone: tz }
}

function body(input: EventInput, tz: string) {
  const out: Record<string, unknown> = {}
  if (input.title != null) out.summary = input.title
  if (input.description != null) out.description = input.description
  if (input.location != null) out.location = input.location
  if (input.start) out.start = when(input.start, Boolean(input.all_day), tz)
  if (input.end) out.end = when(input.end, Boolean(input.all_day), tz)
  if (input.attendees?.length) out.attendees = input.attendees.map((email) => ({ email }))
  return out
}

export async function createEvent(token: string, input: EventInput, tz: string): Promise<EventSummary> {
  const sendUpdates = input.attendees?.length ? "all" : "none"
  return summarize(
    await cal<RawEvent>(token, `calendars/primary/events?sendUpdates=${sendUpdates}`, { method: "POST", body: JSON.stringify(body(input, tz)) }),
  )
}

export async function updateEvent(token: string, eventId: string, input: EventInput, tz: string): Promise<EventSummary> {
  return summarize(
    await cal<RawEvent>(token, `calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: "PATCH",
      body: JSON.stringify(body(input, tz)),
    }),
  )
}

// Fechas que acepta el agente: AAAA-MM-DD o AAAA-MM-DDTHH:MM (opcionalmente con segundos y zona).
export const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/
