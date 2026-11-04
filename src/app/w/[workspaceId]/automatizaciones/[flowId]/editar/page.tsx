import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { asPlan } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { editorData } from "../../editor-data"
import { FlowEditor } from "../../flow-editor"
import { PageHeader } from "@/components/ui"

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
        <PageHeader title={flow.name} description="Solo quien creó esta automatización o un administrador puede cambiar sus pasos." />
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
      <PageHeader
        eyebrow={<Link href={back} className="text-link underline underline-offset-4">{flow.name}</Link>}
        title="Editar pasos"
        description={flow.status === "active" ? "Está activa: los cambios se aplican desde la próxima ejecución. Si cambias cuándo empieza, se pausará para que revises su activación." : undefined}
      />
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
