import "server-only"
import { fileKindLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"

// Lo que el editor necesita saber del espacio: archivos elegidos en Drive,
// integraciones conectadas, cuántos contactos autorizados hay y si hay IA.
export async function editorData(workspaceId: string) {
  const supabase = await createClient()
  const [{ data: files }, { data: integrations }, { count: contacts }, { data: ai }] = await Promise.all([
    supabase.from("integration_files").select("id, name, mime_type").eq("workspace_id", workspaceId).order("name"),
    supabase.from("integrations").select("provider, status").eq("workspace_id", workspaceId),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId),
  ])
  return {
    files: (files ?? []).map((f) => ({ id: f.id, name: f.name, kind: fileKindLabel(f.mime_type).toLowerCase() })),
    connected: (integrations ?? []).filter((i) => i.status === "active").map((i) => i.provider),
    contacts: contacts ?? 0,
    aiReady: (ai ?? []).some((c) => c.status === "active"),
  }
}
