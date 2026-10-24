"use server"

import { refresh } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Zona horaria del espacio y canales de aviso de cada persona. Los permisos
// los comprueban las funciones de la base de datos (RLS y security definer).

export type NoticeState = { error?: string; message?: string; code?: string }

export async function setWorkspaceTimezone(_prev: NoticeState, formData: FormData): Promise<NoticeState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const timezone = String(formData.get("timezone") ?? "").trim()
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  if (timezone && !isTimezone(timezone)) return { error: "Elige una zona horaria de la lista." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("workspace_set_timezone", { p_workspace_id: workspaceId, p_timezone: timezone || null })
  if (error) return { error: error.code === "42501" ? "Solo un administrador puede cambiar la zona horaria." : "No se pudo guardar la zona horaria." }
  refresh()
  return { message: "Zona horaria guardada. Las automatizaciones programadas se han recalculado." }
}

export async function saveNoticePrefs(_prev: NoticeState, formData: FormData): Promise<NoticeState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("notice_prefs_set", {
    p_workspace_id: workspaceId,
    p_push: formData.get("push") === "on",
    p_email: formData.get("email") === "on",
    p_telegram: formData.get("telegram") === "on",
  })
  if (error) return { error: "No se pudieron guardar tus preferencias." }
  refresh()
  return { message: "Preferencias guardadas." }
}

export async function startTelegramLink(_prev: NoticeState, formData: FormData): Promise<NoticeState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("telegram_link_start", { p_workspace_id: workspaceId })
  if (error || typeof data !== "string") return { error: "No se pudo generar el código." }
  return { code: data }
}

export async function unlinkTelegram(_prev: NoticeState, formData: FormData): Promise<NoticeState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("telegram_unlink", { p_workspace_id: workspaceId })
  if (error) return { error: "No se pudo desvincular." }
  refresh()
  return { message: "Telegram desvinculado." }
}

function isTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("es-ES", { timeZone: tz })
    return true
  } catch {
    return false
  }
}
