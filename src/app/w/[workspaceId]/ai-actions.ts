"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { callEdgeFunction } from "@/lib/edge-functions"
import { asPlan, type FlowPlan, isLlmProvider, LLM_PROVIDERS, type LlmProvider } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Las claves de IA nunca se guardan ni se registran en Next.js: se reenvían
// tal cual a la Edge Function, que las valida y las cifra en Vault.

export type AiKeyState = { error?: string; message?: string }

function readProvider(formData: FormData): LlmProvider | null {
  const provider = formData.get("provider")
  return isLlmProvider(provider) ? provider : null
}

function validModel(provider: LlmProvider, model: string): boolean {
  return LLM_PROVIDERS[provider].models.some((m) => m.id === model)
}

export async function saveAiKey(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const provider = readProvider(formData)
  const apiKey = String(formData.get("apiKey") ?? "").trim()
  const model = String(formData.get("model") ?? "")
  if (!UUID_RE.test(workspaceId) || !provider) return { error: "Espacio o proveedor no válido." }
  const info = LLM_PROVIDERS[provider]
  if (!apiKey.startsWith(info.keyPrefix)) return { error: `Pega una clave de ${info.label}: empieza por ${info.keyPrefix}` }
  if (!validModel(provider, model)) return { error: "Elige un modelo." }

  const result = await callEdgeFunction<{ key_hint: string; is_default: boolean }>("ai-connection", {
    workspace_id: workspaceId,
    provider,
    action: "save",
    api_key: apiKey,
    model,
  }, 30_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return {
    message: `Clave de ${info.label} conectada (${result.data.key_hint}).${result.data.is_default ? " Es el proveedor que usa este espacio." : ""}`,
  }
}

export async function setAiModel(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const provider = readProvider(formData)
  const model = String(formData.get("model") ?? "")
  if (!UUID_RE.test(workspaceId) || !provider || !validModel(provider, model)) return { error: "Elige un modelo." }

  const result = await callEdgeFunction("ai-connection", { workspace_id: workspaceId, provider, action: "set_model", model }, 20_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: "Modelo guardado." }
}

export async function setDefaultAi(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const provider = readProvider(formData)
  if (!UUID_RE.test(workspaceId) || !provider) return { error: "Proveedor no válido." }

  const result = await callEdgeFunction("ai-connection", { workspace_id: workspaceId, provider, action: "set_default" }, 20_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: `Ahora este espacio usa ${LLM_PROVIDERS[provider].label}.` }
}

export async function disconnectAi(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const provider = readProvider(formData)
  if (!UUID_RE.test(workspaceId) || !provider) return { error: "Espacio o proveedor no válido." }

  const result = await callEdgeFunction("ai-connection", { workspace_id: workspaceId, provider, action: "delete" }, 20_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: "Clave desconectada y borrada." }
}

// ---------------------------------------------------------------------------
// Asistente
// ---------------------------------------------------------------------------

export type AssistantReply =
  | { ok: true; conversationId: string; messageId: number | null; reply: string; plan: FlowPlan | null }
  | { ok: false; code: string; error: string }

export async function sendAssistantMessage(input: {
  workspaceId: string
  conversationId: string | null
  message: string
}): Promise<AssistantReply> {
  const message = input.message.trim()
  if (!UUID_RE.test(input.workspaceId)) return { ok: false, code: "bad_request", error: "Espacio no válido." }
  if (input.conversationId && !UUID_RE.test(input.conversationId)) {
    return { ok: false, code: "bad_request", error: "Conversación no válida." }
  }
  if (!message) return { ok: false, code: "empty", error: "Escribe qué necesitas." }
  if (message.length > 4000) return { ok: false, code: "too_long", error: "El mensaje no puede pasar de 4000 caracteres." }

  const result = await callEdgeFunction<{ conversation_id: string; message_id: number | null; reply: string; plan: unknown }>(
    "assistant",
    { workspace_id: input.workspaceId, conversation_id: input.conversationId, message },
  )
  if (result.error) return { ok: false, code: result.error.code, error: result.error.message }
  return {
    ok: true,
    conversationId: result.data.conversation_id,
    messageId: result.data.message_id,
    reply: result.data.reply,
    plan: asPlan(result.data.plan as never),
  }
}

// Guarda como borrador el plan de un mensaje del asistente. El plan se lee
// de la base de datos (RLS), nunca del navegador.
export async function saveFlowFromMessage(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const messageId = Number(formData.get("messageId"))
  if (!UUID_RE.test(workspaceId) || !Number.isSafeInteger(messageId)) return

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const { data: msg } = await supabase
    .from("messages")
    .select("id, plan")
    .eq("id", messageId)
    .eq("workspace_id", workspaceId)
    .eq("role", "assistant")
    .maybeSingle()
  const plan = asPlan(msg?.plan)
  if (!msg || !plan) return

  const { data: flow } = await supabase
    .from("flows")
    .insert({
      workspace_id: workspaceId,
      name: plan.name.slice(0, 120),
      summary: plan.summary.slice(0, 2000),
      definition: plan,
      created_by: userId,
      source_message_id: msg.id,
    })
    .select("id")
    .single()
  if (!flow) return
  redirect(`/w/${workspaceId}/automatizaciones/${flow.id}`)
}

export async function deleteFlow(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const flowId = String(formData.get("flowId") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(flowId)) return

  const supabase = await createClient()
  const { data } = await supabase.from("flows").delete().eq("id", flowId).eq("workspace_id", workspaceId).select("id")
  if (data?.length) redirect(`/w/${workspaceId}/automatizaciones`)
}
