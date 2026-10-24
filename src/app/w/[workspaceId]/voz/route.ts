import { type NextRequest, NextResponse } from "next/server"
import { callEdgeFunctionForm } from "@/lib/edge-functions"
import { UUID_RE } from "@/lib/workspace"

// Dictado: recibe la grabación del navegador y la pasa a la Edge Function
// voice-transcribe, que usa la clave de OpenAI del espacio. Es un Route
// Handler (y no una Server Action) para no topar con el límite de tamaño de
// las acciones. El audio no se guarda.
export const maxDuration = 120

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request: NextRequest, { params }: RouteContext<"/w/[workspaceId]/voz">) {
  const { workspaceId } = await params
  if (!UUID_RE.test(workspaceId)) return error(400, "Espacio no válido.")

  // Solo desde la propia app (además, las cookies de sesión son SameSite=Lax).
  const origin = request.headers.get("origin")
  if (!origin || origin !== request.nextUrl.origin) return error(403, "Petición no permitida.")
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
    return error(413, "La grabación es demasiado larga. Prueba con menos de dos minutos.")
  }

  const incoming = await request.formData().catch(() => null)
  const audio = incoming?.get("audio")
  if (!(audio instanceof File) || audio.size === 0) return error(400, "No llegó ninguna grabación.")
  if (audio.size > MAX_BYTES) return error(413, "La grabación es demasiado larga. Prueba con menos de dos minutos.")

  const form = new FormData()
  form.set("workspace_id", workspaceId)
  form.set("seconds", String(Number(incoming?.get("seconds") ?? 0) || 0))
  form.set("audio", audio, audio.name || "dictado")

  const result = await callEdgeFunctionForm<{ text: string }>("voice-transcribe", form, 110_000)
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.error.code === "unauthenticated" ? 401 : 400 })
  return NextResponse.json({ text: result.data.text }, { headers: { "Cache-Control": "no-store" } })
}

function error(status: number, message: string) {
  return NextResponse.json({ error: { code: `http_${status}`, message } }, { status })
}
