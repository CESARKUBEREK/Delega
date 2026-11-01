"use server"

import { refresh } from "next/cache"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { readVoiceConfig } from "@/lib/voice"
import { getWorkspace, UUID_RE } from "@/lib/workspace"

export type CalendarModeState = { error?: string; message?: string }

// Agenda: si las citas de esta automatización se crean con aprobación o
// directamente (hora libre y dentro del horario). Solo administradores.
export async function saveCalendarMode(_prev: CalendarModeState, formData: FormData): Promise<CalendarModeState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const flowId = String(formData.get("flowId") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(flowId)) return { error: "Datos no válidos." }
  const { isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones/${flowId}`)
  if (!isAdmin) return { error: "Solo un administrador puede elegir cómo se reservan las citas." }

  const mode = formData.get("mode") === "auto" ? "auto" : "approval"
  const days = formData.getAll("days").map(Number)
  const ranges = [0, 1]
    .map((i) => ({ from: String(formData.get(`from${i}`) ?? ""), to: String(formData.get(`to${i}`) ?? "") }))
    .filter((r) => r.from && r.to)
  const parsed = readVoiceConfig({ days, ranges })
  if (mode === "auto" && (!days.length || !ranges.length)) return { error: "Elige al menos un día y un horario para las citas." }

  const supabase = await createClient()
  const { data: flow } = await supabase.from("flows").select("settings").eq("id", flowId).eq("workspace_id", workspaceId).maybeSingle()
  if (!flow) return { error: "No se encontró la automatización." }
  const settings = { ...((flow.settings ?? {}) as Record<string, Json | undefined>), calendar: { mode, days: parsed.days, ranges: parsed.ranges } }
  const { data, error } = await supabase.from("flows").update({ settings: settings as Json }).eq("id", flowId).eq("workspace_id", workspaceId).select("id")
  if (error || !data?.length) return { error: "No se pudo guardar." }
  refresh()
  return { message: mode === "auto" ? "Listo: las citas se reservarán solas si la hora está libre." : "Listo: cada cita esperará tu aprobación." }
}
