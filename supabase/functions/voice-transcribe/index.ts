// voice-transcribe: convierte un dictado en texto con la clave de OpenAI del
// espacio (BYOK). Recibe multipart/form-data: workspace_id, audio y seconds.
// El audio no se guarda en ningún sitio: solo pasa por memoria hacia OpenAI.
// El texto vuelve al navegador para que el usuario lo revise antes de enviarlo.
import { authenticate, fail, isUuid, json, membershipRole } from "../_shared/core.ts"

const MAX_BYTES = 8 * 1024 * 1024
const MAX_SECONDS = 150
const MAX_PER_MINUTE = 10
// Modelo actual y, si la cuenta aún no tiene acceso, el anterior.
const MODELS = ["gpt-transcribe", "gpt-4o-mini-transcribe"]
// Formatos que admite OpenAI y que graban los navegadores.
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/mp4": "mp4",
  "video/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
}
// Vocabulario de la app: ayuda a escribir bien los nombres propios.
const PROMPT = "Dictado en español para MarchaSolo: planillas, Google Drive, Google Docs, Gmail, Outlook, Calendar, HubSpot, Telegram, facturas, presupuestos, obras."

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx

  const length = Number(req.headers.get("content-length") ?? 0)
  if (length > MAX_BYTES + 64 * 1024) return fail(413, "too_large", "La grabación es demasiado larga. Prueba con menos de dos minutos.")

  const form = await req.formData().catch(() => null)
  const workspaceId = form?.get("workspace_id")
  const audio = form?.get("audio")
  const seconds = Math.min(MAX_SECONDS, Math.max(0, Number(form?.get("seconds") ?? 0) || 0))
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  if (!(audio instanceof File) || audio.size === 0) return fail(400, "empty", "No llegó ninguna grabación.")
  if (audio.size > MAX_BYTES) return fail(413, "too_large", "La grabación es demasiado larga. Prueba con menos de dos minutos.")
  const type = audio.type.split(";")[0].trim().toLowerCase()
  const ext = EXTENSIONS[type]
  if (!ext) return fail(415, "unsupported", "Este navegador graba en un formato que no se puede transcribir.")

  const role = await membershipRole(ctx, workspaceId)
  if (!role) return fail(403, "forbidden", "No perteneces a este espacio.")

  const since = new Date(Date.now() - 60_000).toISOString()
  const { count } = await ctx.admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("created_by", ctx.userId)
    .eq("kind", "transcription")
    .gte("created_at", since)
  if ((count ?? 0) >= MAX_PER_MINUTE) return fail(429, "rate_limited", "Has dictado muchas veces seguidas. Espera un minuto.")

  const { data: secretRows } = await ctx.admin.rpc("ai_connection_secret", { p_workspace_id: workspaceId, p_provider: "openai" })
  const secret = secretRows?.[0] as { api_key: string; status: string } | undefined
  if (!secret) return fail(409, "no_connection", "Conecta una clave de OpenAI en Integraciones para dictar.")
  if (secret.status !== "active") return fail(409, "invalid_key", "La clave de OpenAI de este espacio dejó de funcionar.")

  const bytes = await audio.arrayBuffer()
  for (const [i, model] of MODELS.entries()) {
    const body = new FormData()
    body.append("file", new File([bytes], `dictado.${ext}`, { type }))
    body.append("model", model)
    body.append("response_format", "json")
    body.append("prompt", PROMPT)

    let response: Response
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret.api_key}` },
        body,
        signal: AbortSignal.timeout(90_000),
      })
    } catch {
      return fail(504, "provider_timeout", "OpenAI tardó demasiado en transcribir. Inténtalo de nuevo.")
    }

    if (response.status === 401) {
      await ctx.admin.rpc("ai_connection_mark_invalid", { p_workspace_id: workspaceId, p_provider: "openai" })
      return fail(409, "invalid_key", "OpenAI ha rechazado la clave de este espacio. Actualízala en Integraciones.")
    }
    if (response.status === 429) return fail(429, "provider_limit", "Tu cuenta de OpenAI ha llegado a su límite o no tiene saldo.")

    const data = (await response.json().catch(() => ({}))) as {
      text?: string
      usage?: { type?: string; seconds?: number; input_tokens?: number; output_tokens?: number }
      error?: { code?: string; message?: string }
    }
    if (!response.ok) {
      // Modelo no disponible para esta cuenta: se prueba con el siguiente.
      const modelProblem = data.error?.code === "model_not_found" || /model/i.test(data.error?.message ?? "")
      if (modelProblem && i < MODELS.length - 1) continue
      console.error("voice-transcribe", response.status, data.error?.code ?? "")
      return fail(502, "provider_error", "OpenAI no pudo transcribir la grabación. Inténtalo de nuevo.")
    }

    const usage = data.usage ?? {}
    await ctx.admin.from("usage_events").insert({
      workspace_id: workspaceId,
      provider: "openai",
      model,
      kind: "transcription",
      audio_seconds: Math.round(Math.min(MAX_SECONDS, usage.type === "duration" && usage.seconds ? usage.seconds : seconds) * 10) / 10,
      input_tokens: Math.max(0, Math.trunc(usage.input_tokens ?? 0)),
      output_tokens: Math.max(0, Math.trunc(usage.output_tokens ?? 0)),
      created_by: ctx.userId,
    })
    return json({ text: String(data.text ?? "").trim().slice(0, 4000) })
  }
  return fail(502, "provider_error", "OpenAI no pudo transcribir la grabación.")
})
