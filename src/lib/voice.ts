// Atención telefónica (Grok Voice): configuración que se edita en
// Integraciones. Debe coincidir con supabase/functions/_shared/voice.ts.

export type HourRange = { from: string; to: string }
export type VoiceConfig = { days: number[]; ranges: HourRange[]; slot_minutes: number; default_minutes: number; file_ids: string[] }

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  days: [1, 2, 3, 4, 5],
  ranges: [{ from: "09:00", to: "14:00" }, { from: "16:00", to: "19:00" }],
  slot_minutes: 30,
  default_minutes: 30,
  file_ids: [],
}

export const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function readVoiceConfig(value: unknown): VoiceConfig {
  const o = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  const days = Array.isArray(o.days) ? [...new Set(o.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : null
  const ranges = Array.isArray(o.ranges)
    ? o.ranges
        .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
        .filter((r) => typeof r.from === "string" && typeof r.to === "string" && HHMM.test(r.from) && HHMM.test(r.to) && r.from < r.to)
        .map((r) => ({ from: r.from as string, to: r.to as string }))
        .slice(0, 3)
    : null
  const num = (v: unknown, min: number, max: number, def: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : def)
  return {
    days: days?.length ? days : DEFAULT_VOICE_CONFIG.days,
    ranges: ranges?.length ? ranges : DEFAULT_VOICE_CONFIG.ranges,
    slot_minutes: num(o.slot_minutes, 10, 120, DEFAULT_VOICE_CONFIG.slot_minutes),
    default_minutes: num(o.default_minutes, 10, 180, DEFAULT_VOICE_CONFIG.default_minutes),
    file_ids: Array.isArray(o.file_ids) ? o.file_ids.filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 10) : [],
  }
}

export function describeHours(c: VoiceConfig): string {
  return `${c.days.map((d) => DAY_NAMES[d - 1]).join(", ")}; ${c.ranges.map((r) => `${r.from}-${r.to}`).join(" y ")}`
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
