import { NextResponse, type NextRequest } from "next/server"
import { callEdgeFunction } from "@/lib/edge-functions"

// Vuelta del consentimiento de Google. El canje del código lo hace la Edge
// Function (con el secreto del cliente OAuth, que nunca llega a Next.js).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const state = params.get("state")
  const back = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin))

  if (params.get("error") || !code || !state) {
    return back(`/integraciones/google?e=${params.get("error") === "access_denied" ? "denied" : "invalid"}`)
  }

  const result = await callEdgeFunction<{ workspace_id: string }>("google-connection", { action: "callback", code, state }, 30_000)
  if (result.error) return back(`/integraciones/google?e=${encodeURIComponent(result.error.code)}`)
  return back(`/w/${result.data.workspace_id}/integraciones?google=conectado`)
}
