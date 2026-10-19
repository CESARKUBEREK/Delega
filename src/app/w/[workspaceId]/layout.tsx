import Link from "next/link"
import { Suspense } from "react"
import { KIND_LABEL, ROLE_LABEL } from "@/lib/labels"
import { getWorkspace } from "@/lib/workspace"
import { PanelNav } from "./panel-nav"

export default function PanelLayout({ children, params }: LayoutProps<"/w/[workspaceId]">) {
  return (
    <div>
      <Suspense fallback={<div className="h-16" aria-busy="true" />}>
        <WorkspaceHeading params={params} />
      </Suspense>
      <div className="mt-6 grid gap-6 lg:grid-cols-[12rem_1fr] lg:gap-8">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <Suspense fallback={<div className="h-11 border border-rule bg-sheet lg:h-64" />}>
            <PanelNav />
          </Suspense>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

async function WorkspaceHeading({ params }: { params: LayoutProps<"/w/[workspaceId]">["params"] }) {
  const { workspaceId } = await params
  const { workspace, role } = await getWorkspace(workspaceId)
  return (
    <div>
      <p className="text-sm">
        <Link href="/w" className="text-stroke underline underline-offset-4">
          Tus espacios
        </Link>
      </p>
      <p className="rotulo mt-2 text-2xl text-ink">{workspace.name}</p>
      <p className="text-sm text-graphite">
        {KIND_LABEL[workspace.kind]}
        {role ? `, eres ${ROLE_LABEL[role].toLowerCase()}` : ""}
      </p>
    </div>
  )
}
