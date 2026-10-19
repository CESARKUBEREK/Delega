// Evita redirecciones abiertas: solo se aceptan rutas internas relativas.
export function safeNext(value: unknown, fallback = "/w"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(value)) return fallback
  return value
}
