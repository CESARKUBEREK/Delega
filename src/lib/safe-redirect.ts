// Evita redirecciones abiertas: solo se aceptan rutas internas relativas.
// Por defecto, a /abrir: la pantalla Hoy del último espacio usado.
export function safeNext(value: unknown, fallback = "/abrir"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback
  if (/[\u0000-\u001f]/.test(value)) return fallback
  return value
}
