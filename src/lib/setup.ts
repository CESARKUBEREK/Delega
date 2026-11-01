import "server-only"
import { createClient } from "@/lib/supabase/server"

// Qué cuentas tiene conectadas un espacio. Lo usan Hoy y el onboarding.
// Cada persona conecta sus propias cuentas: las conexiones son de cada espacio.

export type SetupStatus = Record<"ia" | "correo" | "drive" | "calendario" | "mensajeria", boolean> & { done: number; total: number; complete: boolean }

// Qué pasos están hechos en este espacio (la RLS solo devuelve los datos de
// un espacio del que el usuario es miembro).
export async function setupStatus(workspaceId: string): Promise<SetupStatus> {
  const supabase = await createClient()
  const [{ data: ai }, { data: integrations }] = await Promise.all([
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId),
    supabase
      .from("integrations")
      .select("provider, status")
      .eq("workspace_id", workspaceId)
      .in("provider", ["imap", "google", "calendar", "telegram", "whatsapp"]),
  ])
  const active = (provider: string) => (integrations ?? []).some((i) => i.provider === provider && i.status === "active")
  const status = {
    ia: (ai ?? []).some((c) => c.status === "active"),
    correo: active("imap"),
    drive: active("google"),
    calendario: active("calendar"),
    mensajeria: active("telegram") || active("whatsapp"),
  }
  const done = Object.values(status).filter(Boolean).length
  const total = Object.keys(status).length
  return { ...status, done, total, complete: done === total }
}
