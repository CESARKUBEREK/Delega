import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"
import type { Database } from "./database.types"
import { supabasePublishableKey, supabaseUrl } from "./env"

// Cliente para Server Components, Server Actions y Route Handlers.
// Actúa con la sesión del usuario (nunca con service_role), así que la RLS
// se aplica igual que en el navegador.
//
// connection(): con Cache Components, el SDK de Auth lee Date.now() al cargar
// la sesión y Next.js lo registra como error («unstable value Date.now() while
// prerendering») en cada página de /w. Marcar aquí que hace falta una petición
// real lo evita sin tocar los layouts (poner connection() o
// dynamic = "force-dynamic" en src/app/w/layout.tsx rompe el build: #120, #121).
export async function createClient() {
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: el proxy ya refresca la sesión.
        }
      },
    },
  })
}
