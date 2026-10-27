import Link from "next/link"
import { cache, Suspense } from "react"
import { KIND_LABEL, ROLE_LABEL } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { Logo } from "@/components/logo"
import { AccountMenu } from "../account-menu"
import { PendingInviteNotice } from "../pending-invite-notice"
import { InstallPrompt } from "./install-prompt"
import { MobileTabBar, PanelNav } from "./panel-nav"

export default function PanelLayout({ children, params }: LayoutProps<"/w/[workspaceId]">) {
  return (
    <div className="app-shell pb-24 lg:pb-0">
      <Suspense fallback={<div className="app-topbar h-20" aria-busy="true" />}>
        <WorkspaceHeading params={params} />
      </Suspense>
      <main className="app-frame">
        <div className="app-layout-grid">
          <aside className="app-sidebar hidden lg:sticky lg:top-24 lg:block lg:h-fit">
            <Suspense fallback={<div className="h-64" aria-busy="true" />}>
              <Navigation params={params} variant="side" />
            </Suspense>
          </aside>
          <div className="panel-content">
            <PendingInviteNotice />
            <InstallPrompt />
            {children}
          </div>
        </div>
      </main>
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
    <header className="app-topbar">
      <div className="app-topbar-inner">
        <Link href={`/w/${workspace.id}`} aria-label="Orkesta, Hoy" className="app-brand-link">
          <Logo size={34} id="orkesta-workspace" />
        </Link>
        <span className="app-topbar-divider" aria-hidden="true" />
        <div className="app-current-workspace">
          <span>ESPACIO ACTUAL</span>
          <strong>{workspace.name}</strong>
        </div>
        <div className="app-topbar-spacer" />
        <span className="app-workspace-role">
          {KIND_LABEL[workspace.kind]}{role ? ` · ${ROLE_LABEL[role]}` : ""}
        </span>
        <Link href="/w" className="app-switch-link">Cambiar espacio</Link>
        <Suspense fallback={<span className="h-9 w-9" />}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  )
}
