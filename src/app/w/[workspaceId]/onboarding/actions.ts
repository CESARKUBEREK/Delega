"use server"

import { callEdgeFunction } from "@/lib/edge-functions"
import { asPlan, type FlowPlan } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

export type OnboardingPlanResult =
  | { ok: true; source: "assistant" | "local"; reply: string; plan: FlowPlan; conversationId: string | null }
  | { ok: false; error: string }

// Plan local cuando aún no hay IA conectada (o falla el assistant).
function localPlan(text: string): FlowPlan {
  const t = text.toLowerCase()

  if (t.includes("correo") || t.includes("email") || t.includes("gmail") || t.includes("bandeja") || t.includes("responder")) {
    return {
      version: 1,
      name: "Clasificar y preparar respuestas de correo",
      summary: "Lee los correos recientes, los clasifica por urgencia y prepara borradores de respuesta para que tú apruebes.",
      trigger: { type: "manual", description: "Cuando lo pidas" },
      connections: [{ kind: "email", purpose: "Leer la bandeja y preparar respuestas" }],
      steps: [
        { id: "s1", kind: "read", title: "Leer correos recientes", description: "Consulta la bandeja de los últimos días.", connection: "email", requires_approval: false },
        { id: "s2", kind: "transform", title: "Clasificar por urgencia y tipo", description: "Agrupa urgentes, clientes, facturas y boletines.", connection: "none", requires_approval: false },
        { id: "s3", kind: "generate", title: "Preparar borradores", description: "Redacta respuestas solo para los que lo necesitan.", connection: "email", requires_approval: true },
        { id: "s4", kind: "notify", title: "Mostrarte las propuestas", description: "Tú decides qué se envía.", connection: "none", requires_approval: true },
      ],
      open_questions: ["¿Quieres limitar a ciertos remitentes o carpetas?"],
    }
  }

  if (t.includes("planilla") || t.includes("hoja") || t.includes("excel") || t.includes("sheets") || t.includes("ventas") || t.includes("pedido")) {
    return {
      version: 1,
      name: "Actualizar planilla desde mensajes o pedidos",
      summary: "Lee la información que indiques y actualiza las filas correspondientes en tu planilla, siempre con tu aprobación.",
      trigger: { type: "manual", description: "Cuando lo pidas" },
      connections: [{ kind: "spreadsheet", purpose: "Leer y actualizar la planilla autorizada" }],
      steps: [
        { id: "s1", kind: "read", title: "Localizar la planilla", description: "Usa solo los archivos que hayas autorizado.", connection: "spreadsheet", requires_approval: false },
        { id: "s2", kind: "read", title: "Leer el rango necesario", description: "Consulta las filas relevantes.", connection: "spreadsheet", requires_approval: false },
        { id: "s3", kind: "write", title: "Preparar las filas a escribir", description: "Muestra exactamente qué se va a añadir o modificar.", connection: "spreadsheet", requires_approval: true },
        { id: "s4", kind: "write", title: "Escribir tras tu aprobación", description: "Solo escribe cuando tú lo autorices.", connection: "spreadsheet", requires_approval: true },
      ],
      open_questions: ["¿Qué planilla y qué columnas hay que actualizar?"],
    }
  }

  if (t.includes("calendario") || t.includes("cita") || t.includes("reunión") || t.includes("agenda") || t.includes("evento")) {
    return {
      version: 1,
      name: "Gestionar citas y eventos",
      summary: "Consulta tu agenda y propone eventos. Nunca crea nada sin tu aprobación.",
      trigger: { type: "manual", description: "Cuando lo pidas" },
      connections: [{ kind: "calendar", purpose: "Consultar y proponer eventos" }],
      steps: [
        { id: "s1", kind: "read", title: "Consultar la agenda", description: "Lee los próximos eventos del calendario principal.", connection: "calendar", requires_approval: false },
        { id: "s2", kind: "generate", title: "Proponer el evento", description: "Muestra fecha, hora, título e invitados.", connection: "calendar", requires_approval: true },
        { id: "s3", kind: "write", title: "Crear solo si apruebas", description: "El evento se crea únicamente tras tu autorización.", connection: "calendar", requires_approval: true },
      ],
      open_questions: ["¿En qué calendario y con qué duración por defecto?"],
    }
  }

  return {
    version: 1,
    name: "Automatización a medida",
    summary: text.trim().slice(0, 200),
    trigger: { type: "manual", description: "Cuando lo pidas" },
    connections: [],
    steps: [
      { id: "s1", kind: "transform", title: "Entender la petición", description: "Analiza lo que has descrito.", connection: "none", requires_approval: false },
      { id: "s2", kind: "generate", title: "Proponer un plan concreto", description: "Desglosa los pasos necesarios.", connection: "none", requires_approval: false },
      { id: "s3", kind: "notify", title: "Ejecutar con tu supervisión", description: "Cada acción sensible te pedirá aprobación.", connection: "none", requires_approval: true },
    ],
    open_questions: ["¿Qué herramientas usas hoy para esta tarea?"],
  }
}

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

  const hasAi = (ai ?? []).length > 0

  // Si hay IA conectada, usamos el assistant real.
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
          source: "assistant",
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
