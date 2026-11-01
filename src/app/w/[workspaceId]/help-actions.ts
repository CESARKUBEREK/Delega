"use server"

import { callEdgeFunction } from "@/lib/edge-functions"
import { looksLikeSecret, SECRET_REPLY } from "@/lib/help"
import { UUID_RE } from "@/lib/workspace"

export type HelpTurn = { role: "user" | "assistant"; content: string }
export type HelpAnswer =
  | { ok: true; reply: string; open: string | null; suggestions: string[]; trial: boolean }
  | { ok: false; code: string; error: string }

// Pregunta al ayudante (acción «help» de la función assistant). La
// conversación no se guarda: la manda el panel en cada pregunta.
export async function askHelp(input: {
  workspaceId: string
  page: "integraciones" | "automatizaciones" | "onboarding"
  focus: string | null
  history: HelpTurn[]
  message: string
}): Promise<HelpAnswer> {
  if (!UUID_RE.test(input.workspaceId)) return { ok: false, code: "bad_request", error: "Espacio no válido." }
  const message = input.message.trim().slice(0, 1000)
  if (!message) return { ok: false, code: "empty", error: "Escribe tu pregunta." }
  // Segunda barrera (la primera está en el panel): una clave no sale del servidor.
  if (looksLikeSecret(message)) return { ok: true, reply: SECRET_REPLY, open: input.focus, suggestions: [], trial: false }

  const result = await callEdgeFunction<{ reply: string; open: string | null; suggestions: string[]; trial?: boolean }>(
    "assistant",
    {
      action: "help",
      workspace_id: input.workspaceId,
      page: input.page,
      focus: input.focus,
      history: input.history.slice(-8),
      message,
    },
    60_000,
  )
  if (result.error) return { ok: false, code: result.error.code, error: result.error.message }
  return { ok: true, reply: result.data.reply, open: result.data.open, suggestions: result.data.suggestions ?? [], trial: Boolean(result.data.trial) }
}
