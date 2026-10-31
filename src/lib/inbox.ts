// Utilidades de la bandeja compartidas por las pantallas (fase 6G).

export const DEFAULT_CATEGORIES = ["Cliente", "Proveedor", "Obra o proyecto", "Administración", "Personal", "Publicidad", "Otros"]
export const CHANNEL_LABEL: Record<string, string> = { email: "Correo", telegram: "Telegram", whatsapp: "WhatsApp", phone: "Teléfono" }
export const DEFAULT_DRAFTS_PER_DAY = 30
// Días laborables sin respuesta para proponer un recordatorio.
export const FOLLOWUP_BUSINESS_DAYS = 3

export function domainOf(address: string | null | undefined): string | null {
  const a = (address ?? "").trim().toLowerCase()
  const at = a.lastIndexOf("@")
  return at > 0 && at < a.length - 3 ? a.slice(at + 1) : null
}

// Dominios de correo personal: no se ofrece «todo @gmail.com».
export const PUBLIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "live.com", "yahoo.com", "yahoo.es",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "aol.com", "msn.com",
])

// Hace N días laborables (lunes a viernes).
export function businessDaysAgo(days: number, from = new Date()): Date {
  const d = new Date(from)
  let left = days
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() - 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d
}
