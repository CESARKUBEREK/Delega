import "server-only"
import { headers } from "next/headers"

// URL pública de la app para los enlaces de los correos y el retorno de OAuth.
// En producción se fija con NEXT_PUBLIC_SITE_URL; Supabase solo acepta las
// URLs incluidas en su lista de redirecciones permitidas.
export async function siteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, "")

  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta NEXT_PUBLIC_SITE_URL en producción.")
  }
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}
