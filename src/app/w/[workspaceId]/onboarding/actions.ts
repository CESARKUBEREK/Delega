"use server"

import { callEdgeFunction } from "@/lib/edge-functions"
import { CONNECTION_LABEL, type OnboardingConnection, type OnboardingSource } from "@/lib/onboarding"
import { localPlan } from "@/lib/onboarding-plans"
import { asPlan, type FlowPlan } from "@/lib/plan"
import { setupStatus } from "@/lib/setup"
import { getTrialStatus } from "@/lib/trial"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

export type OnboardingPlanResult =
  | { ok: true; source: OnboardingSource; reply: string; plan: FlowPlan; conversationId: string | null }
  | { ok: false; error: string }

export async function generateOnboardingPlan(input: {
  workspaceId: string
  message: string
}): Promise<OnboardingPlanResult> {
  const message = input.message.trim()
  if (!UUID_RE.test(input.workspaceId)) {
    return { ok: false, error: "Espacio no válido." }
  }
  if (message.length < 12) {
    return { ok: false, error: "Describe la tarea con un poco más de detalle (mínimo 12 caracteres)." }
  }
  if (message.length > 500) {
    return { ok: false, error: "Máximo 500 caracteres." }
  }

  const supabase = await createClient()
  const { data: ai } = await supabase
    .from("ai_connections")
    .select("status")
    .eq("workspace_id", input.workspaceId)
    .eq("status", "active")
    .limit(1)

  const trial = (ai ?? []).length ? null : await getTrialStatus(input.workspaceId)
  // IA propia o créditos de prueba: el plan lo hace el asistente real.
  const hasAi = (ai ?? []).length > 0 || (trial !== null && !trial.exhausted)

  if (hasAi) {
    const result = await callEdgeFunction<{
      conversation_id: string
      message_id: number | null
      reply: string
      plan: unknown
    }>("assistant", {
      workspace_id: input.workspaceId,
      conversation_id: null,
      message: `Quiero automatizar esto: ${message}. Propón un plan claro y concreto, con los pasos necesarios y las conexiones mínimas.`,
    })

    if (!result.error) {
      const plan = asPlan(result.data.plan as never)
      if (plan) {
        return {
          ok: true,
          source: (ai ?? []).length ? "assistant" : "trial",
          reply: result.data.reply,
          plan,
          // La conversación que crea el asistente: el onboarding termina en ella.
          conversationId: UUID_RE.test(result.data.conversation_id ?? "") ? result.data.conversation_id : null,
        }
      }
    }
    // Si el assistant falla, caemos al plan local (no bloqueamos el onboarding).
  }

  // Fallback local (sin IA o si falló el assistant)
  const plan = localPlan(message)
  return {
    ok: true,
    source: "local",
    reply:
      hasAi
        ? "He preparado una propuesta a partir de tu descripción. Puedes afinarla después en el chat."
        : "Todavía no hay una IA conectada en este espacio, así que te muestro una propuesta basada en patrones habituales. Cuando conectes una clave, MarchaSolo podrá generar planes más precisos.",
    plan,
    conversationId: null,
  }
}

export type ConnectionStatusResult =
  | { ok: true; connected: boolean; label: string }
  | { ok: false; error: string }

// ¿Ya está conectado lo que necesita el plan? Usa las mismas reglas que el
// asistente de configuración (/bienvenida). Las planillas viven en Drive, así
// que basta con Drive conectado.
export async function checkOnboardingConnection(input: {
  workspaceId: string
  connection: OnboardingConnection
}): Promise<ConnectionStatusResult> {
  if (!UUID_RE.test(input.workspaceId)) {
    return { ok: false, error: "Espacio no válido." }
  }
  const label = CONNECTION_LABEL[input.connection] ?? CONNECTION_LABEL.none
  if (input.connection === "none") return { ok: true, connected: true, label }

  const status = await setupStatus(input.workspaceId)
  const connected =
    input.connection === "email" ? status.correo : input.connection === "spreadsheet" ? status.drive : input.connection === "calendar" ? status.calendario : false
  return { ok: true, connected, label }
}

// Marca el onboarding de este espacio como terminado (en la base, para todos
// los dispositivos), para que /abrir no vuelva a mandar aquí. Si quien lo
// termina no administra el espacio no se marca nada: /abrir solo manda aquí a
// los administradores.
export async function completeOnboarding(workspaceId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(workspaceId)) return { ok: false, error: "Espacio no válido." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("workspace_complete_onboarding", { p_workspace_id: workspaceId })
  if (error) return { ok: false, error: "No se pudo guardar. Inténtalo de nuevo." }
  return { ok: true }
}

// Paso 5: lo que MarchaSolo ya ha hecho con la bandeja (solo administradores:
// la RLS no deja ver la bandeja a los miembros). null si no hay nada que
// enseñar (sin correo conectado ni conversaciones).
export type OnboardingResult = {
  ownAi: boolean
  total: number
  classified: number
  awaiting: number
  urgent: number
  noise: number
  drafts: number
}

export async function getOnboardingResult(workspaceId: string): Promise<OnboardingResult | null> {
  if (!UUID_RE.test(workspaceId)) return null
  const supabase = await createClient()
  const status = await setupStatus(workspaceId)
  const since14 = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const threads = () =>
    supabase.from("inbox_threads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("archived", false)
  // Mismo criterio que «Para hoy» en la bandeja.
  const awaitingQ = () =>
    threads().eq("automatic", false).eq("needs_reply", true).eq("last_direction", "in").is("prepare_dismissed_at", null).gte("last_message_at", since14)

  const [{ count: total }, { count: classified }, { count: awaiting }, { count: urgent }, { count: noise }, { count: drafts }] = await Promise.all([
    threads(),
    threads().not("classified_at", "is", null),
    awaitingQ(),
    awaitingQ().eq("urgency", "alta"),
    threads().eq("automatic", true).gte("last_message_at", since7),
    supabase
      .from("flow_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("trigger->>type", "inbox_prepare")
      .eq("status", "awaiting_approval"),
  ])
  if (!status.correo && !total) return null
  return {
    ownAi: status.ia,
    total: total ?? 0,
    classified: classified ?? 0,
    awaiting: awaiting ?? 0,
    urgent: urgent ?? 0,
    noise: noise ?? 0,
    drafts: drafts ?? 0,
  }
}
