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
