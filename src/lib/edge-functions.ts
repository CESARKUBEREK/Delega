import "server-only"
import { createClient } from "@/lib/supabase/server"
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env"

export type EdgeError = { code: string; message: string }
export type EdgeResult<T> = { data: T; error?: undefined } | { data?: undefined; error: EdgeError }

// Llama a una Edge Function de Supabase desde el servidor, con el JWT del
// usuario. La función vuelve a verificar la sesión y los permisos: aquí no
// se decide nada. Ninguna clave secreta pasa por Next.js.
export async function callEdgeFunction<T>(name: string, body: unknown, timeoutMs = 115_000): Promise<EdgeResult<T>> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  if (!claims?.claims?.sub || !token) {
    return { error: { code: "unauthenticated", message: "Tu sesión ha caducado. Vuelve a entrar." } }
  }

  let response: Response
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    return { error: { code: "unreachable", message: "No se pudo contactar con el servidor. Inténtalo de nuevo." } }
  }

  const payload = (await response.json().catch(() => null)) as (T & { error?: EdgeError }) | null
  if (!response.ok || !payload || payload.error) {
    return {
      error: payload?.error ?? { code: `http_${response.status}`, message: "Algo ha fallado. Inténtalo de nuevo en unos minutos." },
    }
  }
  return { data: payload }
}
