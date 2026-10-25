import Link from "next/link"
import { Suspense } from "react"
import { getWorkspace } from "@/lib/workspace"
import { editorData } from "../editor-data"
import { FlowEditor } from "../flow-editor"

export const metadata = { title: "Nueva automatización" }

export default function NewFlowPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones/nueva">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          <Link href="../automatizaciones" className="text-link underline underline-offset-4">
            Automatizaciones
          </Link>
        </p>
        <h1 className="rotulo mt-2 text-2xl">Nueva automatización</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Elige cuándo empieza y añade los pasos en orden. Cada paso se describe con tus palabras; si quieres, la IA lo completa por ti.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
        <NewFlow params={params} />
      </Suspense>
    </div>
  )
}

async function NewFlow({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones/nueva">["params"] }) {
  const { workspaceId } = await params
  await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones/nueva`)
  const data = await editorData(workspaceId)
  return (
    <FlowEditor
      workspaceId={workspaceId}
      flowId={null}
      initial={{ name: "", summary: "", trigger: { type: "manual", description: "" }, steps: [] }}
      initialFileIds={[]}
      {...data}
    />
  )
}
