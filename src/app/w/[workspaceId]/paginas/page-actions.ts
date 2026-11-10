"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { byteLength, MAX_PAGE_BYTES, MAX_TITLE_CHARS, pageSections } from "@/lib/pages"
import { createClient } from "@/lib/supabase/server"
import { UUID_RE } from "@/lib/workspace"

// Acciones de las páginas vivas (fase 10-1). La RLS deja tocarlas solo a
// owners y admins; aquí se valida la forma de la entrada. Cada cambio de
// contenido deja una versión a nombre de quien lo hizo (trigger en la base).

export type PageFormState = { error?: string; message?: string }
const NOT_ALLOWED = "Solo un administrador puede cambiar las páginas."

export async function savePage(_prev: PageFormState, formData: FormData): Promise<PageFormState> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const pageId = String(formData.get("pageId") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(pageId)) return { error: "Datos no válidos." }
  const title = String(formData.get("title") ?? "").replace(/\s+/g, " ").trim()
  const content = String(formData.get("content") ?? "").replace(/\r\n/g, "\n")
  if (!title || title.length > MAX_TITLE_CHARS) return { error: `El título debe tener entre 1 y ${MAX_TITLE_CHARS} caracteres.` }
  if (byteLength(content) > MAX_PAGE_BYTES) return { error: `La página supera el máximo de ${MAX_PAGE_BYTES / 1024} KB.` }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("pages")
    .update({ title, content_md: content.trimEnd() + "\n", sections: pageSections(content) })
    .eq("id", pageId)
    .eq("workspace_id", workspaceId)
    .select("id")
  if (error || !data?.length) return { error: NOT_ALLOWED }
  redirect(`/w/${workspaceId}/paginas/${pageId}`)
}

// Vuelve a una versión anterior (queda como versión nueva: no se pierde nada).
export async function restoreVersion(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const pageId = String(formData.get("pageId") ?? "")
  const versionId = Number(formData.get("versionId"))
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(pageId) || !Number.isSafeInteger(versionId)) return
  const supabase = await createClient()
  const { data: version } = await supabase
    .from("page_versions")
    .select("content_md")
    .eq("id", versionId)
    .eq("page_id", pageId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!version) return
  await supabase
    .from("pages")
    .update({ content_md: version.content_md, sections: pageSections(version.content_md) })
    .eq("id", pageId)
    .eq("workspace_id", workspaceId)
  redirect(`/w/${workspaceId}/paginas/${pageId}`)
}

export async function setPageArchived(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const pageId = String(formData.get("pageId") ?? "")
  const archived = formData.get("archived") === "1"
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(pageId)) return
  const supabase = await createClient()
  await supabase
    .from("pages")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", pageId)
    .eq("workspace_id", workspaceId)
  refresh()
}

export async function deletePage(formData: FormData): Promise<void> {
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const pageId = String(formData.get("pageId") ?? "")
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(pageId)) return
  const supabase = await createClient()
  await supabase.from("pages").delete().eq("id", pageId).eq("workspace_id", workspaceId)
  redirect(`/w/${workspaceId}/paginas`)
}
