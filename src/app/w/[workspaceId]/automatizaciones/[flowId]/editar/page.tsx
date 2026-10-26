import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { asPlan } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { editorData } from "../../editor-data"
import { FlowEditor } from "../../flow-editor"

export const metadata = { title: "Editar pasos" }

export default function EditFlowPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones/[flowId]/editar">) {
  return (
    <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
      <EditFlow params={params} />
    </Suspense>
  )
}

async function EditFlow({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones/[flowId]/editar">["params"] }) {
  const { workspaceId, flowId } = await params
  if (!UUID_RE.test(flowId)) notFound()
  const { user, isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones/${flowId}/editar`)
  const supabase = await createClient()
  const { data: flow } = await supabase
    .from("flows")
    .select("id, name, status, definition, settings, created_by")
    .eq("id", flowId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!flow) notFound()
  const back = `/w/${workspaceId}/automatizaciones/${flow.id}`

  if (!isAdmin && flow.created_by !== user.id) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="rotulo text-2xl">{flow.name}</h1>
        <p className="text-graphite">Solo quien creó esta automatización o un administrador puede cambiar sus pasos.</p>
        <Link href={back} className="text-link underline underline-offset-4">
          Volver
        </Link>
      </div>
    )
  }

  const plan = asPlan(flow.definition)
  const data = await editorData(workspaceId)
  const saved = (flow.settings as { file_ids?: unknown } | null)?.file_ids
  const fileIds = Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          <Link href={back} className="text-link underline underline-offset-4">
            {flow.name}
          </Link>
        </p>
        <h1 className="rotulo mt-2 text-2xl">Editar pasos</h1>
        {flow.status === "active" ? (
          <p className="mt-1 max-w-prose text-sm text-graphite">
            Está activa: los cambios se aplican desde la próxima ejecución. Si cambias cuándo empieza, se pausará para que revises su activación.
          </p>
        ) : null}
      </div>
      <FlowEditor
        workspaceId={workspaceId}
        flowId={flow.id}
        initial={{
          name: plan?.name ?? flow.name,
          summary: plan?.summary ?? "",
          trigger: { type: plan?.trigger.type ?? "manual", description: plan?.trigger.description ?? "" },
          steps: (plan?.steps ?? []).map((s) => ({ kind: s.kind, title: s.title, description: s.description, connection: s.connection || "none" })),
        }}
        initialFileIds={fileIds}
        {...data}
      />
    </div>
  )
}
