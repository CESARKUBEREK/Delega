import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Todo salvo archivos estáticos, imágenes, el service worker, el manifiesto
    // y el servidor MCP (/mcp y sus metadatos OAuth, que van a Supabase).
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|mcp$|\\.well-known/oauth-protected-resource|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
}
