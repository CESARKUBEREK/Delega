"use server"

import { refresh } from "next/cache"
import { callEdgeFunction } from "@/lib/edge-functions"
import { asPlan } from "@/lib/plan"
import { type EditorStep, MAX_FILES, normalizePlan } from "@/lib/plan-edit"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Acciones del editor visual de flujos. El plan que llega del navegador se
// vuelve a normalizar aquí (src/lib/plan-edit.ts) y la base de datos impone la
// aprobación otra vez (trigger flows_enforce_approval). Los permisos los aplica
// RLS: crear, cualquier miembro (como borrador); editar, autor o admin.

export type SaveFlowResult = { ok: true; flowId: string; paused: boolean } | { ok: false; error: string }

export async function saveFlowPlan(input: {
  workspaceId: string
  flowId: string | null
  plan: unknown
  fileIds: string[]
}): Promise<SaveFlowResult> {
  if (!UUID_RE.test(input.workspaceId) || (input.flowId !== null && !UUID_RE.test(input.flowId))) {
    return { ok: false, error: "Datos no válidos." }
  }
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." }

  const existing = input.flowId
    ? (await supabase.from("flows").select("id, status, definition, settings").eq("id", input.flowId).eq("workspace_id", input.workspaceId).maybeSingle()).data
    : null
  if (input.flowId && !existing) return { ok: false, error: "No se encontró la automatización." }
  const previous = existing ? asPlan(existing.definition) : null

  const result = normalizePlan(input.plan, previous)
  if (!result.ok) return result
  const plan = result.plan

  // Solo archivos que este espacio ya eligió en Drive (RLS).
  const wanted = (Array.isArray(input.fileIds) ? input.fileIds : []).filter((id) => typeof id === "string" && UUID_RE.test(id)).slice(0, MAX_FILES)
  const { data: files } = wanted.length
    ? await supabase.from("integration_files").select("id").eq("workspace_id", input.workspaceId).in("id", wanted)
    : { data: [] as { id: string }[] }
  const fileIds = wanted.filter((id) => files?.some((f) => f.id === id))

  if (!existing) {
    const { data: flow, error } = await supabase
      .from("flows")
      .insert({
        workspace_id: input.workspaceId,
        name: plan.name,
        summary: plan.summary,
        definition: plan as unknown as Json,
        settings: fileIds.length ? { file_ids: fileIds } : {},
        created_by: userId,
      })
      .select("id")
      .single()
    if (error || !flow) return { ok: false, error: "No se pudo crear la automatización." }
    return { ok: true, flowId: flow.id, paused: false }
  }

  // Si cambia cómo arranca una automatización activa, se pausa para que se
  // revise su activación (filtros, hora, canal) antes de volver a funcionar.
  const triggerChanged = previous?.trigger.type !== plan.trigger.type
  const pause = existing.status === "active" && triggerChanged
  const settings = { ...((existing.settings ?? {}) as { [key: string]: Json | undefined }), file_ids: fileIds }
  const { data: updated, error } = await supabase
    .from("flows")
    .update({
      name: plan.name,
      summary: plan.summary,
      definition: plan as unknown as Json,
      settings,
      ...(pause ? { status: "paused" } : {}),
    })
    .eq("id", existing.id)
    .eq("workspace_id", input.workspaceId)
    .select("id")
  if (error || !updated?.length) return { ok: false, error: "Solo quien creó la automatización o un administrador puede cambiarla." }
  refresh()
  return { ok: true, flowId: existing.id, paused: pause }
}

export type SuggestResult = { ok: true; step: EditorStep } | { ok: false; error: string }

// «Complétalo tú»: la IA del espacio convierte una frase en un paso.
export async function suggestStep(input: { workspaceId: string; text: string; context: string }): Promise<SuggestResult> {
  if (!UUID_RE.test(input.workspaceId)) return { ok: false, error: "Espacio no válido." }
  const text = String(input.text ?? "").trim()
  if (!text) return { ok: false, error: "Escribe qué tiene que hacer este paso." }
  if (text.length > 1000) return { ok: false, error: "Descríbelo en menos de 1000 caracteres." }
  const result = await callEdgeFunction<{ step: EditorStep }>(
    "assistant",
    { action: "step", workspace_id: input.workspaceId, text, context: String(input.context ?? "").slice(0, 2000) },
    60_000,
  )
  if (result.error) return { ok: false, error: result.error.message }
  const s = result.data.step
  return { ok: true, step: { kind: s.kind, title: s.title, description: s.description, connection: s.connection } }
}
