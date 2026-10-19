import Link from "next/link"
import { Suspense } from "react"
import { FLOW_STATUS_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "../format"

export const metadata = { title: "Automatizaciones" }

export default function FlowsPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="rotulo text-2xl">Automatizaciones</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Los planes que guardas desde el asistente. Por ahora son borradores para revisar; la ejecución llegará en la siguiente fase.
        </p>
      </div>
      <Suspense fallback={<div className="h-48 border border-rule bg-sheet" aria-busy="true" />}>
        <FlowList params={params} />
      </Suspense>
    </div>
  )
}

async function FlowList({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones">["params"] }) {
  const { workspaceId } = await params
  await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones`)
  const supabase = await createClient()
  const { data: flows } = await supabase
    .from("flows")
    .select("id, name, summary, status, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
  const base = `/w/${workspaceId}`

  if (!flows || flows.length === 0) {
    return (
      <div className="border border-ink bg-sheet p-5">
        <p className="text-ink">Aún no hay automatizaciones en este espacio.</p>
        <Link href={`${base}/asistente`} className="mt-3 inline-block text-sm text-stroke underline underline-offset-4">
          Describe una tarea al asistente
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-rule border border-ink bg-sheet">
      {flows.map((f) => (
        <li key={f.id}>
          <Link href={`${base}/automatizaciones/${f.id}`} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-paper">
            <span className="min-w-0">
              <span className="block font-medium text-ink">{f.name}</span>
              {f.summary ? <span className="line-clamp-2 text-sm text-graphite">{f.summary}</span> : null}
            </span>
            <span className="shrink-0 text-right text-sm text-graphite">
              <span className="block">{FLOW_STATUS_LABEL[f.status] ?? f.status}</span>
              <span className="text-xs">{formatDateTime(f.updated_at)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
