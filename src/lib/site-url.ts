import "server-only"
import { headers } from "next/headers"

// URL pública de la app para los enlaces de los correos y el retorno de OAuth.
// En producción, NEXT_PUBLIC_SITE_URL debe ser https://marchasolo.com. Orden:
// NEXT_PUBLIC_SITE_URL → URL estable de la rama en Vercel → cabeceras locales.
// Supabase solo acepta las URLs incluidas en su lista de redirecciones.
export async function siteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/+$/, "")

  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta NEXT_PUBLIC_SITE_URL en producción.")
  }
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}
