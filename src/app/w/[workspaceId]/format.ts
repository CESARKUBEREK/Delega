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
