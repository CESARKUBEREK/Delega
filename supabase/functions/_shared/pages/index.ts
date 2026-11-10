// Páginas vivas (fase 10-1): lo que hace la herramienta update_page del agente.
// Escribir una página no sale del espacio, así que no pide aprobación. Cada
// cambio deja una versión (trigger page_record_version) con la ejecución.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { byteLength, diffLines, diffStats, MAX_PAGE_BYTES, MAX_TITLE_CHARS, pageSections, pageSlug, replaceSection } from "./core.ts"

// Límites para que una automatización no llene el espacio de páginas.
export const MAX_PAGES_PER_WORKSPACE = 100
export const MAX_PAGE_UPDATES_PER_RUN = 10

export type PageRun = { id: string; workspace_id: string; flow_id?: string | null }

export type UpdatePageResult =
  | { ok: true; page_id: string; title: string; section: string | null; created: boolean; added: number; removed: number; bytes: number }
  | { ok: false; error: string }

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : ""
}

export async function updatePage(
  admin: SupabaseClient,
  run: PageRun,
  args: Record<string, unknown>,
  updatesSoFar: number,
): Promise<UpdatePageResult> {
  if (updatesSoFar >= MAX_PAGE_UPDATES_PER_RUN) {
    return { ok: false, error: `Como mucho ${MAX_PAGE_UPDATES_PER_RUN} actualizaciones de página por ejecución.` }
  }
  const title = text(args.page, MAX_TITLE_CHARS + 1).replace(/\s+/g, " ").trim()
  if (!title || title.length > MAX_TITLE_CHARS) return { ok: false, error: `El nombre de la página debe tener entre 1 y ${MAX_TITLE_CHARS} caracteres.` }
  const slug = pageSlug(title)
  if (!slug) return { ok: false, error: "El nombre de la página necesita letras o números." }
  const section = text(args.section, 200).replace(/\s+/g, " ").trim()
  const content = text(args.content, MAX_PAGE_BYTES * 2)
  if (!content.trim() && !section) return { ok: false, error: "Falta el contenido de la página." }

  const { data: existing, error: readError } = await admin
    .from("pages")
    .select("id, title, content_md, flow_id")
    .eq("workspace_id", run.workspace_id)
    .eq("slug", slug)
    .maybeSingle()
  if (readError) return { ok: false, error: "No se pudo leer la página." }

  if (!existing) {
    const { count } = await admin.from("pages").select("id", { count: "exact", head: true }).eq("workspace_id", run.workspace_id)
    if ((count ?? 0) >= MAX_PAGES_PER_WORKSPACE) return { ok: false, error: `El espacio ya tiene ${MAX_PAGES_PER_WORKSPACE} páginas. Archiva o borra alguna.` }
  }

  const before = existing?.content_md ?? ""
  const next = replaceSection(before, section, content)
  const bytes = byteLength(next)
  if (bytes > MAX_PAGE_BYTES) {
    return { ok: false, error: `La página quedaría en ${Math.ceil(bytes / 1024)} KB y el máximo es ${MAX_PAGE_BYTES / 1024} KB. Resume el contenido.` }
  }
  const stats = diffStats(diffLines(before, next))
  const row = {
    content_md: next,
    sections: pageSections(next),
    updated_by_run: run.id,
    flow_id: existing?.flow_id ?? run.flow_id ?? null,
    archived_at: null,
  }

  if (existing) {
    const { error } = await admin.from("pages").update(row).eq("id", existing.id)
    if (error) return { ok: false, error: "No se pudo guardar la página." }
    return { ok: true, page_id: existing.id, title: existing.title, section: section || null, created: false, ...stats, bytes }
  }
  const { data: created, error } = await admin
    .from("pages")
    .insert({ workspace_id: run.workspace_id, title, slug, created_by: null, ...row })
    .select("id")
    .single()
  if (error || !created) return { ok: false, error: "No se pudo crear la página." }
  return { ok: true, page_id: created.id, title, section: section || null, created: true, ...stats, bytes }
}

export function updatePageTitle(r: UpdatePageResult): string {
  if (!r.ok) return `No se pudo actualizar la página: ${r.error}`
  const where = r.section ? ` (sección «${r.section}»)` : ""
  return r.created ? `Creó la página «${r.title}»${where}` : `Actualizó la página «${r.title}»${where}: +${r.added} / −${r.removed} líneas`
}
