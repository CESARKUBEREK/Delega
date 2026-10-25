// Transcripción de audio con la clave de OpenAI del espacio (BYOK). La usa
// telegram-webhook para las notas de voz del chat propio. El audio solo pasa
// por memoria hacia OpenAI; no se guarda.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

const MODELS = ["gpt-transcribe", "gpt-4o-mini-transcribe"]
const PROMPT = "Dictado en español para Orkesta: planillas, Google Drive, Google Docs, Gmail, Outlook, Calendar, HubSpot, Telegram, Tokko, Xubio, facturas, presupuestos, obras."
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024
export const MAX_AUDIO_SECONDS = 150

export class TranscribeError extends Error {}

export async function transcribe(
  admin: SupabaseClient,
  input: { workspaceId: string; userId: string; bytes: Uint8Array<ArrayBuffer>; filename: string; type: string; seconds: number },
): Promise<string> {
  const { data: rows } = await admin.rpc("ai_connection_secret", { p_workspace_id: input.workspaceId, p_provider: "openai" })
  const secret = rows?.[0] as { api_key: string; status: string } | undefined
  if (!secret) throw new TranscribeError("Para entender notas de voz hace falta una clave de OpenAI en Integraciones.")
  if (secret.status !== "active") throw new TranscribeError("La clave de OpenAI de este espacio dejó de funcionar.")

  for (const [i, model] of MODELS.entries()) {
    const body = new FormData()
    body.append("file", new File([input.bytes], input.filename, { type: input.type }))
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
      throw new TranscribeError("OpenAI tardó demasiado en transcribir. Inténtalo de nuevo.")
    }
    if (response.status === 401) {
      await admin.rpc("ai_connection_mark_invalid", { p_workspace_id: input.workspaceId, p_provider: "openai" })
      throw new TranscribeError("OpenAI ha rechazado la clave de este espacio. Actualízala en Integraciones.")
    }
    if (response.status === 429) throw new TranscribeError("Tu cuenta de OpenAI ha llegado a su límite o no tiene saldo.")
    const data = (await response.json().catch(() => ({}))) as {
      text?: string
      usage?: { type?: string; seconds?: number; input_tokens?: number; output_tokens?: number }
      error?: { code?: string; message?: string }
    }
    if (!response.ok) {
      const modelProblem = data.error?.code === "model_not_found" || /model/i.test(data.error?.message ?? "")
      if (modelProblem && i < MODELS.length - 1) continue
      throw new TranscribeError("OpenAI no pudo transcribir la nota de voz.")
    }
    const usage = data.usage ?? {}
    await admin.from("usage_events").insert({
      workspace_id: input.workspaceId,
      provider: "openai",
      model,
      kind: "transcription",
      audio_seconds: Math.round(Math.min(MAX_AUDIO_SECONDS, usage.type === "duration" && usage.seconds ? usage.seconds : input.seconds) * 10) / 10,
      input_tokens: Math.max(0, Math.trunc(usage.input_tokens ?? 0)),
      output_tokens: Math.max(0, Math.trunc(usage.output_tokens ?? 0)),
      created_by: input.userId,
    })
    return String(data.text ?? "").trim().slice(0, 4000)
  }
  throw new TranscribeError("OpenAI no pudo transcribir la nota de voz.")
}
