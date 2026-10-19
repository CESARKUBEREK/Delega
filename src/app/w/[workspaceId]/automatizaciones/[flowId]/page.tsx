import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PlanView } from "@/components/plan-view"
import { asPlan, FLOW_STATUS_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { deleteFlow } from "../../ai-actions"
import { formatDateTime } from "../../format"

export const metadata = { title: "Automatización" }

export default function FlowPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones/[flowId]">) {
  return (
    <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
      <Flow params={params} />
    </Suspense>
  )
}

async function Flow({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones/[flowId]">["params"] }) {
  const { workspaceId, flowId } = await params
  if (!UUID_RE.test(flowId)) notFound()
  const { user, isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones/${flowId}`)
  const supabase = await createClient()

  const { data: flow } = await supabase
    .from("flows")
    .select("id, name, status, definition, created_by, created_at, updated_at, source_message_id")
    .eq("id", flowId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!flow) notFound()

  const plan = asPlan(flow.definition)
  const canDelete = isAdmin || flow.created_by === user.id
  const base = `/w/${workspaceId}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          <Link href={`${base}/automatizaciones`} className="text-stroke underline underline-offset-4">
            Automatizaciones
          </Link>
        </p>
        <h1 className="rotulo mt-2 text-2xl">{flow.name}</h1>
        <p className="mt-1 text-sm text-graphite">
          {FLOW_STATUS_LABEL[flow.status] ?? flow.status}, guardado el {formatDateTime(flow.created_at)}
        </p>
      </div>

      {plan ? <PlanView plan={plan} /> : <p className="text-graphite">Este flujo no tiene un plan legible.</p>}

      <div className="border-l-2 border-rule pl-4 text-sm text-graphite">
        <p>
          Esta automatización todavía no se puede ejecutar. Cuando estén listas las planillas y la ejecución, podrás
          probarla paso a paso y aprobar cada paso marcado como «Requiere tu aprobación».
        </p>
        <p className="mt-2">
          Para cambiar el plan, pídeselo al asistente
          {flow.source_message_id ? " en la conversación original" : ""} y guarda la nueva versión.
        </p>
      </div>

      {canDelete ? (
        <form action={deleteFlow} className="border-t border-rule pt-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="flowId" value={flow.id} />
          <button type="submit" className="text-sm text-alert underline underline-offset-4">
            Borrar esta automatización
          </button>
        </form>
      ) : null}
    </div>
  )
}
