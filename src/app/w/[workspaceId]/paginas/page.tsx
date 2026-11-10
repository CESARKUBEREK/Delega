import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { EmptyState, PageHeader, PanelCard } from "@/components/ui"

export const metadata = { title: "Páginas" }

export default function PagesPage({ params, searchParams }: PageProps<"/w/[workspaceId]/paginas">) {
  return (
    <div className="automation-page flex flex-col gap-6">
      <PageHeader
        eyebrow="EQUIPO DIGITAL"
        title="Páginas"
        description="Informes y resúmenes que tus automatizaciones mantienen al día. No se envían a nadie: tú decides qué compartir."
      />
      <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
        <PageList params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function PageList({ params, searchParams }: Pick<PageProps<"/w/[workspaceId]/paginas">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const sp = await searchParams
  const base = `/w/${workspaceId}`
  const { isAdmin } = await getWorkspace(workspaceId, `${base}/paginas`)
  if (!isAdmin) return <p className="text-graphite">Las páginas solo las ven los administradores del espacio.</p>

  const showArchived = sp.archivadas === "1"
  const supabase = await createClient()
  let query = supabase
    .from("pages")
    .select("id, title, updated_at, archived_at, sections, flow_id")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(100)
  query = showArchived ? query.not("archived_at", "is", null) : query.is("archived_at", null)
  const { data: pages } = await query
  const flowIds = [...new Set((pages ?? []).map((p) => p.flow_id).filter((id): id is string => !!id))]
  const { data: flows } = flowIds.length
    ? await supabase.from("flows").select("id, name").in("id", flowIds)
    : { data: [] as { id: string; name: string }[] }
  const flowName = new Map((flows ?? []).map((f) => [f.id, f.name]))

  if (!pages?.length && !showArchived) {
    return (
      <EmptyState
        title="Todavía no hay páginas"
        description="Una automatización crea una página la primera vez que la actualiza. Para empezar, prueba la plantilla «Informe para el propietario»."
        action={
          <Link href={`${base}/automatizaciones/plantillas`} className="text-link underline underline-offset-4">
            Ver plantillas
          </Link>
        }
      />
    )
  }

  return (
    <PanelCard
      title={showArchived ? "Archivadas" : "Tus páginas"}
      actions={
        <Link href={showArchived ? `${base}/paginas` : `${base}/paginas?archivadas=1`} className="text-sm text-link underline underline-offset-4">
          {showArchived ? "Ver las activas" : "Ver archivadas"}
        </Link>
      }
      bodyPadding="none"
    >
      {pages?.length ? (
        <ul className="divide-y divide-rule">
          {pages.map((p) => {
            const flow = p.flow_id ? flowName.get(p.flow_id) : undefined
            const sections = Array.isArray(p.sections) ? (p.sections as string[]) : []
            return (
              <li key={p.id}>
                <Link href={`${base}/paginas/${p.id}`} className="block px-4 py-3 hover:bg-rule/20">
                  <p className="font-semibold text-ink">{p.title}</p>
                  <p className="mt-0.5 text-sm text-graphite">
                    Actualizada el {formatDateTime(p.updated_at)}
                    {flow ? ` · la mantiene «${flow}»` : " · sin automatización"}
                  </p>
                  {sections.length ? <p className="mt-0.5 truncate text-xs text-graphite">{sections.join(" · ")}</p> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="px-4 py-3 text-graphite">No hay páginas archivadas.</p>
      )}
    </PanelCard>
  )
}
