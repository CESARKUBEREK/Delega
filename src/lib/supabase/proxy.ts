import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "./database.types"
import { supabasePublishableKey, supabaseUrl } from "./env"

// Rutas que exigen sesión y rutas que solo tienen sentido sin ella.
const PROTECTED_PREFIXES = ["/w", "/reset-password", "/integraciones", "/abrir"]
// /w/<espacio>/…: se recuerda el último espacio para abrir la app instalada en él.
const WORKSPACE_PATH = /^\/w\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"]

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // No añadir código entre createServerClient y getClaims(): refresca el
  // token caducado y lo valida. Sin esto, las sesiones se cortan al azar.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ""
    const redirect = NextResponse.redirect(url)
    // Conserva las cookies de sesión recién refrescadas.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (pathname === "/") {
    return redirectTo(signedIn ? "/w" : "/login")
  }

  if (!signedIn && matches(pathname, PROTECTED_PREFIXES)) {
    const redirect = redirectTo("/login")
    const url = new URL(redirect.headers.get("location")!)
    url.searchParams.set("next", `${pathname}${search}`)
    redirect.headers.set("location", url.toString())
    return redirect
  }

  if (signedIn && matches(pathname, GUEST_ONLY)) {
    return redirectTo("/w")
  }

  const workspace = signedIn ? pathname.match(WORKSPACE_PATH)?.[1] : undefined
  if (workspace && request.cookies.get("orkesta_ws")?.value !== workspace) {
    response.cookies.set("orkesta_ws", workspace, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return response
}
