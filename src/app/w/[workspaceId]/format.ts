const dateTime = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
})

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso))
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("es-ES").format(n)
}

// Fecha y hora larga en una zona horaria concreta (p. ej. la del espacio).
export function formatLong(iso: string, timeZone: string) {
  let tz = timeZone
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: tz })
  } catch {
    tz = "Europe/Madrid"
  }
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(
    new Date(iso),
  )
}

function safeZone(timeZone: string | null | undefined): string {
  const tz = timeZone || "Europe/Madrid"
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: tz })
    return tz
  } catch {
    return "Europe/Madrid"
  }
}

// Día del calendario (AAAA-MM-DD) de un instante en una zona horaria.
function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

// «Martes 27 de octubre», en la zona del espacio.
export function formatToday(timeZone: string | null | undefined, now = new Date()): string {
  const tz = safeZone(timeZone)
  const text = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now)
  return text.charAt(0).toUpperCase() + text.slice(1).replace(",", "")
}

// «Buenos días», «Buenas tardes» o «Buenas noches» según la hora local.
export function greeting(timeZone: string | null | undefined, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: safeZone(timeZone) }).format(now))
  if (hour >= 6 && hour < 14) return "Buenos días"
  if (hour >= 14 && hour < 21) return "Buenas tardes"
  return "Buenas noches"
}

// Cuándo toca algo, corto: «17:00», «Mañana 8:00» o «Lun 3 nov, 8:00».
export function formatWhen(iso: string, timeZone: string | null | undefined, now = new Date()): string {
  const tz = safeZone(timeZone)
  const date = new Date(iso)
  const time = new Intl.DateTimeFormat("es-ES", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(date)
  const day = dayKey(date, tz)
  if (day === dayKey(now, tz)) return time
  if (day === dayKey(new Date(now.getTime() + 86_400_000), tz)) return `Mañana ${time}`
  const rest = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: tz }).format(date)
  return `${rest.charAt(0).toUpperCase() + rest.slice(1).replace(",", "")}, ${time}`
}
