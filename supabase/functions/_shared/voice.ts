// Atención telefónica con Grok Voice (xAI). MarchaSolo no atiende la llamada:
// la atiende el agente de voz que el usuario crea en xAI con su número. Ese
// agente se conecta, como servidor MCP remoto, a la función voice-mcp de este
// espacio y usa estas herramientas:
//
// - huecos_libres    huecos de la agenda (Google Calendar) en el horario de citas.
// - reservar_cita    crea la cita directamente en el calendario (el usuario
//                    eligió que las citas por teléfono queden confirmadas),
//                    solo dentro del horario y sin solaparse con nada.
// - tomar_recado     deja el recado en la Bandeja.
// - listar_documentos / leer_documento
//                    solo los archivos de Drive elegidos para el teléfono.
//
// Cada cita y cada recado se guardan en la Bandeja (canal «phone») y se avisa a
// los administradores del espacio (push y Telegram, según sus preferencias).
// El texto de quien llama es información, nunca instrucciones.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { calendarToken, createEvent, listEvents } from "./calendar.ts"
import { workspaceTimezone } from "./core.ts"
import { accessTokenFrom, GoogleError, readDriveText } from "./google.ts"
import { recordMessage } from "./inbox.ts"
import { sendPush } from "./push.ts"
import { parseTelegramSecret, sendTelegram } from "./telegram.ts"

export const VOICE_PROVIDER = "grok_voice"
export const VOICE_TOKEN_RE = /^msv_[A-Za-z0-9_-]{30,80}$/
const MAX_DOC_CHARS = 12_000
const MAX_DOCS = 10
const BOOKING_HORIZON_DAYS = 90
const MIN_NOTICE_MIN = 30

export type HourRange = { from: string; to: string }
export type VoiceConfig = {
  // Días de citas, ISO: 1 = lunes … 7 = domingo.
  days: number[]
  ranges: HourRange[]
  slot_minutes: number
  default_minutes: number
  file_ids: string[]
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  days: [1, 2, 3, 4, 5],
  ranges: [{ from: "09:00", to: "14:00" }, { from: "16:00", to: "19:00" }],
  slot_minutes: 30,
  default_minutes: 30,
  file_ids: [],
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`

// Lee la configuración guardada sin fiarse de su forma.
export function readVoiceConfig(value: unknown): VoiceConfig {
  const o = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const days = Array.isArray(o.days) ? [...new Set(o.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : null
  const ranges = Array.isArray(o.ranges)
    ? o.ranges
        .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
        .filter((r) => typeof r.from === "string" && typeof r.to === "string" && HHMM.test(r.from) && HHMM.test(r.to) && toMin(r.from) < toMin(r.to))
        .map((r) => ({ from: r.from as string, to: r.to as string }))
        .slice(0, 3)
    : null
  const num = (v: unknown, min: number, max: number, def: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : def)
  return {
    days: days?.length ? days : DEFAULT_VOICE_CONFIG.days,
    ranges: ranges?.length ? ranges : DEFAULT_VOICE_CONFIG.ranges,
    slot_minutes: num(o.slot_minutes, 10, 120, DEFAULT_VOICE_CONFIG.slot_minutes),
    default_minutes: num(o.default_minutes, 10, 180, DEFAULT_VOICE_CONFIG.default_minutes),
    file_ids: Array.isArray(o.file_ids) ? o.file_ids.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, MAX_DOCS) : [],
  }
}

// ---------------------------------------------------------------------------
// Fechas en la zona del espacio
// ---------------------------------------------------------------------------
function offsetMinutes(tz: string, at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT"
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/)
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0
}

// «2026-11-03» + «10:30» en la zona tz → instante (ms).
export function localToUtc(date: string, hhmm: string, tz: string): number {
  const [y, mo, d] = date.split("-").map(Number)
  const guess = Date.UTC(y, mo - 1, d, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)))
  const first = guess - offsetMinutes(tz, new Date(guess)) * 60_000
  return guess - offsetMinutes(tz, new Date(first)) * 60_000
}

export function localDate(at: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at)
}

function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return w === 0 ? 7 : w
}

const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

export function describeHours(c: VoiceConfig): string {
  const days = c.days.map((d) => DAY_NAMES[d - 1]).join(", ")
  return `${days}; ${c.ranges.map((r) => `${r.from}-${r.to}`).join(" y ")}`
}

function spokenDate(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const day = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)))
  return `${day} a las ${hhmm}`
}

// ---------------------------------------------------------------------------
// Huecos de la agenda
// ---------------------------------------------------------------------------
type Busy = { start: number; end: number }

async function busyTimes(token: string, date: string, tz: string): Promise<Busy[]> {
  const dayStart = localToUtc(date, "00:00", tz)
  const dayEnd = dayStart + 24 * 3_600_000
  const events = await listEvents(token, new Date(dayStart).toISOString(), new Date(dayEnd).toISOString(), null, 100)
  return events.map((e) =>
    e.all_day
      ? { start: dayStart, end: dayEnd }
      : { start: Date.parse(e.start), end: Date.parse(e.end) },
  ).filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end))
}

export function freeSlots(c: VoiceConfig, date: string, minutes: number, busy: Busy[], tz: string, now = Date.now()): string[] {
  if (!c.days.includes(isoWeekday(date))) return []
  const out: string[] = []
  for (const r of c.ranges) {
    for (let m = toMin(r.from); m + minutes <= toMin(r.to); m += c.slot_minutes) {
      const start = localToUtc(date, fromMin(m), tz)
      const end = start + minutes * 60_000
      if (start < now + MIN_NOTICE_MIN * 60_000) continue
      if (busy.some((b) => b.start < end && b.end > start)) continue
      out.push(fromMin(m))
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Herramientas (MCP)
// ---------------------------------------------------------------------------
export type VoiceContext = {
  admin: SupabaseClient
  workspaceId: string
  integrationId: string
  config: VoiceConfig
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/

export function voiceTools(c: VoiceConfig): { name: string; description: string; inputSchema: Record<string, unknown> }[] {
  const obj = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", additionalProperties: false, properties, required })
  const hours = describeHours(c)
  const tools = [
    {
      name: "huecos_libres",
      description: `Devuelve las horas libres para una cita en una fecha (formato 24 h, hora local del negocio). Horario de citas: ${hours}.`,
      inputSchema: obj(
        {
          fecha: { type: "string", description: "AAAA-MM-DD" },
          duracion_minutos: { type: "integer", description: `Duración de la cita; por defecto ${c.default_minutes}.` },
        },
        ["fecha"],
      ),
    },
    {
      name: "reservar_cita",
      description:
        "Reserva una cita en la agenda del negocio, ya confirmada. Antes, consulta huecos_libres y confirma con la persona el día, la hora, su nombre y su teléfono.",
      inputSchema: obj(
        {
          nombre: { type: "string" },
          telefono: { type: "string" },
          inicio: { type: "string", description: "AAAA-MM-DDTHH:MM, hora local del negocio." },
          duracion_minutos: { type: "integer" },
          motivo: { type: "string", description: "Para qué es la cita, en pocas palabras." },
        },
        ["nombre", "telefono", "inicio", "motivo"],
      ),
    },
    {
      name: "tomar_recado",
      description: "Deja un recado para el negocio cuando la persona quiere que la llamen, pide algo que no puedes resolver o deja un mensaje.",
      inputSchema: obj(
        {
          nombre: { type: "string" },
          telefono: { type: "string" },
          motivo: { type: "string", description: "Asunto del recado, en pocas palabras." },
          mensaje: { type: "string", description: "Lo que hay que saber, con los datos que dio la persona." },
          urgente: { type: "boolean" },
        },
        ["nombre", "telefono", "motivo", "mensaje"],
      ),
    },
  ]
  if (c.file_ids.length) {
    tools.push(
      {
        name: "listar_documentos",
        description: "Lista los documentos del negocio que puedes consultar (horarios, precios, servicios, preguntas frecuentes…).",
        inputSchema: obj({}, []),
      },
      {
        name: "leer_documento",
        description: "Lee un documento del negocio para responder con datos exactos. No inventes lo que no esté en los documentos.",
        inputSchema: obj({ nombre: { type: "string", description: "Nombre del documento, tal como lo da listar_documentos." } }, ["nombre"]),
      },
    )
  }
  return tools
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "")
const phoneKey = (p: string) => p.replace(/[^\d+]/g, "").slice(0, 20) || "desconocido"

export class VoiceError extends Error {}

export async function callVoiceTool(ctx: VoiceContext, name: string, args: Record<string, unknown>): Promise<string> {
  const { admin, workspaceId, config } = ctx
  const tz = await workspaceTimezone(admin, workspaceId)

  if (name === "huecos_libres") {
    const fecha = s(args.fecha, 10)
    if (!DATE_ONLY.test(fecha)) throw new VoiceError("Fecha no válida: usa AAAA-MM-DD.")
    const minutes = typeof args.duracion_minutos === "number" ? Math.min(180, Math.max(10, Math.trunc(args.duracion_minutos))) : config.default_minutes
    if (!config.days.includes(isoWeekday(fecha))) return `Ese día (${fecha}) no hay citas. Horario de citas: ${describeHours(config)}.`
    const { token } = await calendar(admin, workspaceId)
    const slots = freeSlots(config, fecha, minutes, await busyTimes(token, fecha, tz), tz)
    return slots.length
      ? `Horas libres el ${fecha} para ${minutes} minutos: ${slots.slice(0, 16).join(", ")}.`
      : `No quedan horas libres el ${fecha}. Prueba otro día.`
  }

  if (name === "reservar_cita") {
    const nombre = s(args.nombre, 120)
    const telefono = s(args.telefono, 40)
    const motivo = s(args.motivo, 300)
    const m = s(args.inicio, 16).match(DATE_TIME)
    if (!nombre || !telefono || !motivo) throw new VoiceError("Faltan el nombre, el teléfono o el motivo.")
    if (!m) throw new VoiceError("Fecha y hora no válidas: usa AAAA-MM-DDTHH:MM.")
    const [, fecha, hora] = m
    const minutes = typeof args.duracion_minutos === "number" ? Math.min(180, Math.max(10, Math.trunc(args.duracion_minutos))) : config.default_minutes
    const start = localToUtc(fecha, hora, tz)
    if (start > Date.now() + BOOKING_HORIZON_DAYS * 86_400_000) throw new VoiceError(`Solo se reservan citas en los próximos ${BOOKING_HORIZON_DAYS} días.`)
    const { token } = await calendar(admin, workspaceId)
    // Se vuelve a comprobar justo antes de crearla: horario y que nada se solape.
    if (!freeSlots({ ...config, slot_minutes: 1 }, fecha, minutes, await busyTimes(token, fecha, tz), tz).includes(hora)) {
      throw new VoiceError("Esa hora no está libre o está fuera del horario de citas. Consulta huecos_libres y propón otra.")
    }
    const endLocal = fromMin(toMin(hora) + minutes)
    const event = await createEvent(
      token,
      {
        title: `Cita: ${nombre}`,
        start: `${fecha}T${hora}`,
        end: `${fecha}T${endLocal}`,
        description: `Reservada por teléfono con MarchaSolo.\nTeléfono: ${telefono}\nMotivo: ${motivo}`,
      },
      tz,
    )
    const when = spokenDate(fecha, hora)
    await record(ctx, { nombre, telefono, subject: `Cita reservada: ${motivo}`.slice(0, 300), body: `Cita reservada por teléfono para el ${when} (${minutes} min).\nNombre: ${nombre}\nTeléfono: ${telefono}\nMotivo: ${motivo}${event.link ? `\nEn el calendario: ${event.link}` : ""}` })
    await notifyAdmins(ctx, `📞 Cita reservada por teléfono`, `${nombre} (${telefono}) — ${when}\nMotivo: ${motivo}`)
    return `Cita confirmada para el ${when}, a nombre de ${nombre}.`
  }

  if (name === "tomar_recado") {
    const nombre = s(args.nombre, 120)
    const telefono = s(args.telefono, 40)
    const motivo = s(args.motivo, 300)
    const mensaje = typeof args.mensaje === "string" ? args.mensaje.trim().slice(0, 4000) : ""
    if (!nombre || !telefono || !motivo || !mensaje) throw new VoiceError("Faltan el nombre, el teléfono, el motivo o el mensaje.")
    const urgente = args.urgente === true
    await record(ctx, { nombre, telefono, subject: `${urgente ? "URGENTE · " : ""}Recado: ${motivo}`.slice(0, 300), body: `Recado telefónico${urgente ? " (urgente)" : ""}.\nNombre: ${nombre}\nTeléfono: ${telefono}\nMotivo: ${motivo}\n\n${mensaje}` })
    await notifyAdmins(ctx, `📞 ${urgente ? "Recado URGENTE" : "Recado"} por teléfono`, `${nombre} (${telefono})\n${motivo}\n\n${mensaje.slice(0, 1500)}`)
    return "Recado anotado. El negocio lo verá enseguida."
  }

  if (name === "listar_documentos" || name === "leer_documento") {
    const docs = await documents(ctx)
    if (name === "listar_documentos") return docs.length ? `Documentos: ${docs.map((d) => d.name).join("; ")}.` : "No hay documentos disponibles."
    const wanted = s(args.nombre, 300).toLowerCase()
    const doc = docs.find((d) => d.name.toLowerCase() === wanted) ?? docs.find((d) => d.name.toLowerCase().includes(wanted))
    if (!doc || !wanted) throw new VoiceError("No encuentro ese documento. Usa listar_documentos.")
    const token = await googleAccess(admin, workspaceId)
    const text = await readDriveText(token, { id: doc.provider_file_id, mimeType: doc.mime_type ?? "" })
    return `${doc.name}:\n${text.slice(0, MAX_DOC_CHARS)}${text.length > MAX_DOC_CHARS ? "\n[…documento recortado]" : ""}`
  }

  throw new VoiceError("Herramienta desconocida.")
}

async function calendar(admin: SupabaseClient, workspaceId: string) {
  try {
    return await calendarToken(admin, workspaceId)
  } catch (e) {
    throw new VoiceError(e instanceof GoogleError ? `${e.message} Toma un recado en su lugar.` : "La agenda no está disponible. Toma un recado en su lugar.")
  }
}

async function googleAccess(admin: SupabaseClient, workspaceId: string): Promise<string> {
  const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "google" })
  const secret = data?.[0] as { refresh_token: string; status: string } | undefined
  if (!secret || secret.status !== "active") throw new VoiceError("Los documentos no están disponibles ahora.")
  return (await accessTokenFrom(secret.refresh_token)).token
}

async function documents(ctx: VoiceContext): Promise<{ provider_file_id: string; name: string; mime_type: string | null }[]> {
  if (!ctx.config.file_ids.length) return []
  const { data } = await ctx.admin
    .from("integration_files")
    .select("provider_file_id, name, mime_type")
    .eq("workspace_id", ctx.workspaceId)
    .in("id", ctx.config.file_ids)
  return (data ?? []).filter((f) => f.mime_type !== "application/vnd.google-apps.folder")
}

// Guarda la llamada en la Bandeja: una conversación por número de teléfono.
async function record(ctx: VoiceContext, m: { nombre: string; telefono: string; subject: string; body: string }) {
  await recordMessage(ctx.admin, {
    workspaceId: ctx.workspaceId,
    integrationId: ctx.integrationId,
    channel: "phone",
    threadExternalId: `phone:${phoneKey(m.telefono)}`,
    externalId: `call:${crypto.randomUUID()}`,
    direction: "in",
    senderName: m.nombre,
    senderAddress: m.telefono,
    subject: m.subject,
    body: m.body,
    sentAt: new Date().toISOString(),
    contactName: m.nombre,
    contactAddress: m.telefono,
  })
}

// Aviso a los administradores: push sin datos del cliente y Telegram con el detalle.
async function notifyAdmins(ctx: VoiceContext, title: string, text: string) {
  const { admin, workspaceId } = ctx
  const { data: members } = await admin.from("memberships").select("user_id, role").eq("workspace_id", workspaceId).eq("status", "active")
  const ids = (members ?? []).filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.user_id)
  if (!ids.length) return
  const { data: prefs } = await admin
    .from("user_channels")
    .select("user_id, notify_push, notify_telegram, telegram_chat_id")
    .eq("workspace_id", workspaceId)
    .in("user_id", ids)
  const pref = (id: string) => (prefs ?? []).find((p) => p.user_id === id)
  const pushTo = ids.filter((id) => pref(id)?.notify_push ?? true)
  await sendPush(admin, pushTo, { title: "MarchaSolo · Teléfono", body: "Tienes una llamada nueva en la bandeja.", url: `/w/${workspaceId}/bandeja`, tag: `phone-${workspaceId}` }).catch(() => null)
  const chats = ids.map(pref).filter((p) => p && (p.notify_telegram ?? true) && p.telegram_chat_id).map((p) => p!.telegram_chat_id!)
  if (!chats.length) return
  try {
    const { data } = await admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "telegram" })
    const bot = parseTelegramSecret((data?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
    if (bot) for (const chat of chats) await sendTelegram(bot.bot_token, chat, `${title}\n\n${text}`).catch(() => null)
  } catch {
    // Sin Telegram: el aviso push y la bandeja bastan.
  }
}

// Comparación de la clave sin filtrar tiempos.
export function sameToken(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  if (x.length !== y.length) return false
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

// Instrucciones para pegar en el agente de voz de xAI.
export function playbook(businessName: string, c: VoiceConfig): string {
  return `Eres la recepcionista telefónica de ${businessName}. Hablas en español, con frases cortas, amables y claras.
- Si quieren una cita: pregunta qué necesitan y para qué día. Consulta huecos_libres y ofrece dos o tres horas. Cuando la persona elija,
  confirma día, hora, nombre y teléfono, y solo entonces usa reservar_cita. Horario de citas: ${describeHours(c)}.
- Si preguntan por horarios, precios o servicios: ${c.file_ids.length ? "busca la respuesta con listar_documentos y leer_documento" : "di que lo consultas"} y no inventes nada.
- Si no puedes resolverlo, quieren hablar con alguien o dejan un mensaje: toma un recado con tomar_recado (nombre, teléfono, motivo y mensaje).
- Nunca des datos de otros clientes ni de la agenda más allá de si una hora está libre.
- Al terminar, resume lo acordado y despídete.`
}
