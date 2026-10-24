import Link from "next/link"
import { cache, Suspense } from "react"
import { KIND_LABEL, ROLE_LABEL } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { InstallPrompt } from "./install-prompt"
import { MobileTabBar, PanelNav } from "./panel-nav"

export default function PanelLayout({ children, params }: LayoutProps<"/w/[workspaceId]">) {
  return (
    // En el móvil deja sitio a la barra inferior.
    <div className="pb-24 lg:pb-0">
      <Suspense fallback={<div className="h-16" aria-busy="true" />}>
        <WorkspaceHeading params={params} />
      </Suspense>
      <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-[12rem_1fr] lg:gap-8">
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:h-fit">
          <Suspense fallback={<div className="h-64 border border-rule bg-sheet" />}>
            <Navigation params={params} variant="side" />
          </Suspense>
        </aside>
        <div className="min-w-0">
          <InstallPrompt />
          {children}
        </div>
      </div>
      <Suspense fallback={null}>
        <Navigation params={params} variant="bottom" />
      </Suspense>
    </div>
  )
}

// Aprobaciones pendientes visibles para el usuario (las suyas o, si es
// administrador, las de todo el espacio: lo decide la RLS).
const pendingApprovals = cache(async (workspaceId: string): Promise<number> => {
  if (!UUID_RE.test(workspaceId)) return 0
  const supabase = await createClient()
  const { count } = await supabase
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "awaiting_approval")
  return count ?? 0
})

async function Navigation({ params, variant }: { params: LayoutProps<"/w/[workspaceId]">["params"]; variant: "side" | "bottom" }) {
  const { workspaceId } = await params
  const pending = await pendingApprovals(workspaceId)
  return variant === "side" ? <PanelNav pending={pending} /> : <MobileTabBar pending={pending} />
}

async function WorkspaceHeading({ params }: { params: LayoutProps<"/w/[workspaceId]">["params"] }) {
  const { workspaceId } = await params
  const { workspace, role } = await getWorkspace(workspaceId)
  return (
    <div>
      <p className="text-sm">
        <Link href="/w" className="text-link underline underline-offset-4">
          Tus espacios
        </Link>
      </p>
      <p className="rotulo mt-2 text-xl text-ink lg:text-2xl">{workspace.name}</p>
      <p className="text-sm text-graphite">
        {KIND_LABEL[workspace.kind]}
        {role ? `, eres ${ROLE_LABEL[role].toLowerCase()}` : ""}
      </p>
    </div>
  )
}
