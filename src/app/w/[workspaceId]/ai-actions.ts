"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { callEdgeFunction } from "@/lib/edge-functions"
import { AI_PROVIDERS, type AiProvider, asPlan, type FlowPlan, scheduleOf } from "@/lib/plan"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { findTemplate } from "@/lib/templates"
import { UUID_RE } from "@/lib/workspace"

// La clave de la IA nunca se guarda ni se registra en Next.js: se reenvía
// tal cual a la Edge Function, que la valida y la cifra en Vault.

export type AiKeyState = { error?: string; message?: string }

const PROVIDER_IDS = new Set<string>(AI_PROVIDERS.map((p) => p.id))

function providerFrom(formData: FormData): AiProvider | null {
  const p = String(formData.get("provider") ?? "")
  return PROVIDER_IDS.has(p) ? (p as AiProvider) : null
}

function modelFor(provider: AiProvider, formData: FormData): string | null {
  const model = String(formData.get("model") ?? "")
  return AI_PROVIDERS.find((p) => p.id === provider)?.models.some((m) => m.id === model) ? model : null
}

export async function saveAiKey(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const apiKey = String(formData.get("apiKey") ?? "").trim()
  const provider = providerFrom(formData)
  if (!UUID_RE.test(workspaceId) || !provider) return { error: "Datos no válidos." }
  const info = AI_PROVIDERS.find((p) => p.id === provider)!
  if (!apiKey.startsWith(info.keyPrefix)) return { error: `Pega una clave de ${info.label}: empieza por ${info.keyPrefix}` }
  const model = modelFor(provider, formData)
  if (!model) return { error: "Elige un modelo." }

  const result = await callEdgeFunction<{ key_hint: string }>("ai-connection", {
    workspace_id: workspaceId,
    action: "save",
    provider,
    api_key: apiKey,
    model,
  }, 30_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: `Clave conectada (${result.data.key_hint}).` }
}

export async function setAiModel(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const provider = providerFrom(formData)
  const model = provider ? modelFor(provider, formData) : null
  if (!UUID_RE.test(workspaceId) || !provider || !model) return { error: "Elige un modelo." }

  const result = await callEdgeFunction("ai-connection", { workspace_id: workspaceId, action: "set_model", provider, model }, 20_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: "Modelo guardado." }
}

export async function setDefaultAi(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const provider = providerFrom(formData)
  if (!UUID_RE.test(workspaceId) || !provider) return { error: "Datos no válidos." }
  const result = await callEdgeFunction("ai-connection", { workspace_id: workspaceId, action: "set_default", provider }, 20_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: "Ahora es la IA principal del espacio." }
}

export async function disconnectAi(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const provider = providerFrom(formData)
  if (!UUID_RE.test(workspaceId) || !provider) return { error: "Datos no válidos." }

  const result = await callEdgeFunction("ai-connection", { workspace_id: workspaceId, action: "delete", provider }, 20_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: "Clave desconectada y borrada." }
}

// IA de una automatización: un modelo concreto o, si se deja vacío, la
// principal del espacio. Lo guarda la persona con su sesión (RLS).
export async function setFlowModel(_prev: AiKeyState, formData: FormData): Promise<AiKeyState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const flowId = String(formData.get("flowId") ?? "")
  const model = String(formData.get("model") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(flowId)) return { error: "Datos no válidos." }
  if (model && !AI_PROVIDERS.some((p) => p.models.some((m) => m.id === model))) return { error: "Elige un modelo." }

  const supabase = await createClient()
  const { data: flow } = await supabase.from("flows").select("settings").eq("id", flowId).eq("workspace_id", workspaceId).maybeSingle()
  if (!flow) return { error: "No se encontró la automatización." }
  const settings = { ...((flow.settings ?? {}) as { [key: string]: Json | undefined }) }
  if (model) settings.model = model
  else delete settings.model
  const { data, error } = await supabase.from("flows").update({ settings }).eq("id", flowId).eq("workspace_id", workspaceId).select("id")
  if (error || !data?.length) return { error: "Solo quien creó la automatización o un administrador puede cambiarla." }
  refresh()
  return { message: model ? "Esta automatización usará ese modelo." : "Esta automatización usará la IA principal." }
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
      // La hora que propuso el asistente rellena la programación (se confirma al activar).
      settings: scheduleOf(msg.plan) ? { schedule: scheduleOf(msg.plan) } : {},
      created_by: userId,
      source_message_id: msg.id,
    })
    .select("id")
    .single()
  if (!flow) return
  redirect(`/w/${workspaceId}/automatizaciones/${flow.id}`)
}

// Crea un borrador a partir de una plantilla (src/lib/templates.ts). El plan se
// toma del servidor, nunca del navegador.
export async function createFlowFromTemplate(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const template = findTemplate(String(formData.get("templateId") ?? ""))
  if (!UUID_RE.test(workspaceId) || !template) return

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) redirect("/login")

  const { data: flow } = await supabase
    .from("flows")
    .insert({
      workspace_id: workspaceId,
      name: template.plan.name,
      summary: template.plan.summary,
      definition: template.plan,
      settings: (template.settings ?? {}) as Json,
      created_by: userId,
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
