"use server"

import { refresh } from "next/cache"
import { callEdgeFunction } from "@/lib/edge-functions"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Asistente de voz en la web del cliente. Crear o cambiar el identificador lo
// hace voice-connection; los ajustes se guardan con la sesión (RLS: admins).

export type VoiceWebState = { error?: string; message?: string }

export async function createVoiceWeb(workspaceId: string, rotate = false): Promise<VoiceWebState> {
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const result = await callEdgeFunction<{ public_id: string }>("voice-connection", { action: rotate ? "web_rotate" : "web_create", workspace_id: workspaceId }, 20_000)
  if (result.error) return { error: result.error.message }
  refresh()
  return { message: rotate ? "Código nuevo creado. Cambia el código en tu web: el anterior ya no funciona." : "Asistente creado. Actívalo cuando lo hayas probado." }
}

const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/

export async function saveVoiceWeb(_prev: VoiceWebState, formData: FormData): Promise<VoiceWebState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  if (!UUID_RE.test(workspaceId)) return { error: "Espacio no válido." }
  const int = (k: string, min: number, max: number, def: number) => {
    const n = Number(formData.get(k))
    return Number.isInteger(n) && n >= min && n <= max ? n : def
  }
  const domains = String(formData.get("domains") ?? "")
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .filter(Boolean)
  if (domains.some((d) => !DOMAIN_RE.test(d))) return { error: "Escribe los dominios sin https:// (por ejemplo, miclinica.com)." }
  const title = String(formData.get("title") ?? "").trim().slice(0, 60) || "Habla con nosotros"
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("voice_web_widgets")
    .update({
      enabled: formData.get("enabled") === "on",
      title,
      sessions_per_day: int("sessionsPerDay", 1, 500, 20),
      minutes_per_session: int("minutesPerSession", 1, 30, 8),
      allowed_domains: [...new Set(domains)].slice(0, 10),
    })
    .eq("workspace_id", workspaceId)
    .select("workspace_id")
  if (error || !data?.length) return { error: "Solo un administrador puede cambiar el asistente de la web." }
  refresh()
  return { message: "Ajustes guardados." }
}
