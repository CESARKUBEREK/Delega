import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Markdown } from "@/components/markdown"
import { diffLines, diffStats } from "@/lib/pages"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime } from "../../format"
import { InfoBanner, PageHeader, PanelCard } from "@/components/ui"
import { deletePage, restoreVersion, setPageArchived } from "../page-actions"
import { PageEditor } from "./page-editor"

export const metadata = { title: "Página" }

type Props = PageProps<"/w/[workspaceId]/paginas/[pageId]">

export default function LivePage({ params, searchParams }: Props) {
  return (
    <div className="automation-page flex flex-col gap-6">
      <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
        <PageView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function PageView({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { workspaceId, pageId } = await params
  const sp = await searchParams
  if (!UUID_RE.test(pageId)) notFound()
  const base = `/w/${workspaceId}`
  const here = `${base}/paginas/${pageId}`
  const { isAdmin } = await getWorkspace(workspaceId, here)
  if (!isAdmin) return <p className="text-graphite">Las páginas solo las ven los administradores del espacio.</p>

  const supabase = await createClient()
  const [{ data: page }, { data: versions }] = await Promise.all([
    supabase
      .from("pages")
      .select("id, title, content_md, updated_at, archived_at, flow_id, updated_by_run")
      .eq("id", pageId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("page_versions")
      .select("id, content_md, flow_run_id, edited_by, created_at")
      .eq("page_id", pageId)
      .order("id", { ascending: false })
      .limit(50),
  ])
  if (!page) notFound()
  const { data: flow } = page.flow_id
    ? await supabase.from("flows").select("id, name").eq("id", page.flow_id).maybeSingle()
    : { data: null }

  const list = versions ?? []
  const versionParam = typeof sp.v === "string" ? Number(sp.v) : NaN
  const changesParam = typeof sp.cambios === "string" ? Number(sp.cambios) : NaN
  const editing = sp.editar === "1"
  const shown = Number.isSafeInteger(versionParam) ? list.find((v) => v.id === versionParam) : undefined
  const changesIdx = Number.isSafeInteger(changesParam) ? list.findIndex((v) => v.id === changesParam) : -1
  const changes = changesIdx >= 0 ? { after: list[changesIdx], before: list[changesIdx + 1] } : null

  const who = (v: (typeof list)[number]) =>
    v.flow_run_id ? (
      <Link href={`${base}/ejecuciones/${v.flow_run_id}`} className="text-link underline underline-offset-4">una ejecución</Link>
    ) : v.edited_by ? (
      "edición a mano"
    ) : (
      "automatización"
    )

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`${base}/paginas`} className="hover:underline">PÁGINAS</Link>}
        title={page.title}
        description={
          <>
            Actualizada el {formatDateTime(page.updated_at)}
            {flow ? <> · la mantiene <Link href={`${base}/automatizaciones/${flow.id}`} className="text-link underline underline-offset-4">{flow.name}</Link></> : null}
          </>
        }
        actions={
          editing ? null : (
            <div className="flex flex-wrap gap-2">
              <Link href={`${here}?editar=1`} className="ms-button ms-button-secondary">Editar</Link>
              {flow ? (
                <Link href={`${base}/automatizaciones/${flow.id}`} className="ms-button ms-button-primary" title="Abre la automatización para lanzarla ahora">
                  Actualizar ahora
                </Link>
              ) : null}
            </div>
          )
        }
      />

      {page.archived_at ? (
        <InfoBanner tone="warning">
          Esta página está archivada. Si su automatización la vuelve a actualizar, sale del archivo.
        </InfoBanner>
      ) : null}

      {editing ? (
        <PanelCard title="Editar la página" description="Markdown sencillo: ## para las secciones, - para las listas, **negrita**. Al guardar queda una versión nueva.">
          <PageEditor workspaceId={workspaceId} pageId={page.id} title={page.title} content={page.content_md} cancelHref={here} />
        </PanelCard>
      ) : changes ? (
        <PanelCard
          title={`Cambios del ${formatDateTime(changes.after.created_at)}`}
          description={changes.before ? `Comparado con la versión del ${formatDateTime(changes.before.created_at)}.` : "Primera versión de la página."}
          actions={<Link href={here} className="text-sm text-link underline underline-offset-4">Volver a la página</Link>}
        >
          <Diff before={changes.before?.content_md ?? ""} after={changes.after.content_md} />
        </PanelCard>
      ) : (
        <PanelCard
          title={shown ? `Versión del ${formatDateTime(shown.created_at)}` : undefined}
          actions={
            shown ? (
              <div className="flex flex-wrap items-center gap-3">
                <form action={restoreVersion}>
                  <input type="hidden" name="workspaceId" value={workspaceId} />
                  <input type="hidden" name="pageId" value={page.id} />
                  <input type="hidden" name="versionId" value={shown.id} />
                  <button type="submit" className="text-sm text-link underline underline-offset-4">Volver a esta versión</button>
                </form>
                <Link href={here} className="text-sm text-link underline underline-offset-4">Ver la actual</Link>
              </div>
            ) : undefined
          }
        >
          <Markdown source={shown ? shown.content_md : page.content_md} />
        </PanelCard>
      )}

      {list.length ? (
        <PanelCard title="Versiones" description="Las 50 últimas. Cada actualización y cada edición dejan una." bodyPadding="none">
          <ol className="divide-y divide-rule">
            {list.map((v, i) => {
              // Solo las 10 más recientes, para no comparar 50 versiones en cada visita.
              const stats = i < 10 && i + 1 < list.length ? diffStats(diffLines(list[i + 1].content_md, v.content_md)) : null
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="text-ink">{formatDateTime(v.created_at)}</span>
                  <span className="text-graphite">{who(v)}</span>
                  {stats ? <span className="tabular-nums text-graphite">+{stats.added} / −{stats.removed}</span> : i + 1 === list.length ? <span className="text-graphite">primera versión</span> : null}
                  <span className="ml-auto flex gap-3">
                    <Link href={`${here}?cambios=${v.id}`} className="text-link underline underline-offset-4">Ver cambios</Link>
                    {i > 0 ? <Link href={`${here}?v=${v.id}`} className="text-link underline underline-offset-4">Ver</Link> : null}
                  </span>
                </li>
              )
            })}
          </ol>
        </PanelCard>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm">
        <form action={setPageArchived}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="pageId" value={page.id} />
          <input type="hidden" name="archived" value={page.archived_at ? "0" : "1"} />
          <button type="submit" className="text-link underline underline-offset-4">{page.archived_at ? "Sacar del archivo" : "Archivar"}</button>
        </form>
        <form action={deletePage}>
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="pageId" value={page.id} />
          <button type="submit" className="text-alert underline underline-offset-4">Borrar la página y sus versiones</button>
        </form>
      </div>
    </>
  )
}

function Diff({ before, after }: { before: string; after: string }) {
  const lines = diffLines(before, after)
  const { added, removed } = diffStats(lines)
  if (!added && !removed) return <p className="text-graphite">Sin cambios.</p>
  return (
    <div>
      <p className="mb-2 text-sm text-graphite tabular-nums">+{added} líneas / −{removed} líneas</p>
      <pre className="overflow-x-auto rounded-lg border border-rule text-sm leading-relaxed">
        {lines.map((l, i) => (
          <div
            key={i}
            className={`px-3 ${l.op === "add" ? "bg-emerald-50 text-ink" : l.op === "del" ? "bg-red-50 text-graphite line-through" : "text-graphite"}`}
          >
            <span aria-hidden="true" className="mr-2 select-none">{l.op === "add" ? "+" : l.op === "del" ? "−" : " "}</span>
            <span className="sr-only">{l.op === "add" ? "Añadido: " : l.op === "del" ? "Quitado: " : ""}</span>
            {l.text || " "}
          </div>
        ))}
      </pre>
    </div>
  )
}
