import Link from "next/link"
import { Suspense } from "react"
import { runOrigin } from "@/lib/labels"
import { asPending } from "@/lib/pending"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { ApprovalCard, RunControls } from "../ejecuciones/[runId]/run-live"
import { formatDateTime } from "../format"
import { PushToggle } from "../push-toggle"
import { EmptyState, PageHeader, PanelCard } from "@/components/ui"

export const metadata = { title: "Aprobaciones" }
// Las ejecuciones en curso avanzan desde aquí por tramos de hasta ~90 s.
export const maxDuration = 120

export default function ApprovalsPage({ params }: PageProps<"/w/[workspaceId]/aprobaciones">) {
  return (
    <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
      <Approvals params={params} />
    </Suspense>
  )
}

async function Approvals({ params }: { params: PageProps<"/w/[workspaceId]/aprobaciones">["params"] }) {
  const { workspaceId } = await params
  await getWorkspace(workspaceId, `/w/${workspaceId}/aprobaciones`)
  const supabase = await createClient()
  const base = `/w/${workspaceId}`

  // La RLS solo devuelve las ejecuciones propias o, a un administrador, todas.
  const { data: runs } = await supabase
    .from("flow_runs")
    .select("id, flow_name, status, pending_action, trigger, started_at, updated_at")
    .eq("workspace_id", workspaceId)
    .in("status", ["awaiting_approval", "running"])
    .order("updated_at", { ascending: false })
    .limit(40)

  const waiting = (runs ?? []).filter((r) => r.status === "awaiting_approval")
  const running = (runs ?? []).filter((r) => r.status === "running").slice(0, 5)

  return (
    <div className="automation-page flex flex-col">
      <PageHeader
        eyebrow="TU CONTROL, SIEMPRE"
        title="Aprobaciones"
        description="Revisa lo que MarchaSolo quiere escribir o enviar. Nada sale del espacio sin tu aprobación."
      />

      {waiting.length === 0 && running.length === 0 ? (
        <EmptyState
          title="Todo al día"
          description="Cuando una tarea necesite escribir o enviar algo, aparecerá aquí para que la revises."
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>}
        />
      ) : waiting.length > 0 ? (
        <section className="automation-approvals" aria-labelledby="approvals-pending-title">
          <div className="automation-section-heading">
            <div>
              <p className="automation-section-eyebrow">ESPERANDO TU REVISIÓN</p>
              <h2 id="approvals-pending-title">Pendientes</h2>
            </div>
            <span className="automation-count">{waiting.length} {waiting.length === 1 ? "tarea" : "tareas"}</span>
          </div>
          <div className="automation-approval-list">
            {waiting.map((run) => {
              const pending = asPending(run.pending_action)
              return (
                <article key={run.id} className="automation-approval-item">
                  <p className="automation-approval-meta">
                    <Link href={`${base}/ejecuciones/${run.id}`} className="automation-approval-name">
                      {run.flow_name}
                    </Link>
                    <span>{runOrigin(run.trigger)}</span>
                    <time dateTime={run.started_at}>{formatDateTime(run.started_at)}</time>
                  </p>
                  {pending ? (
                    <ApprovalCard runId={run.id} pending={pending} />
                  ) : (
                    <p className="automation-approval-unavailable">
                      Esta acción no se puede mostrar aquí.{" "}
                      <Link href={`${base}/ejecuciones/${run.id}`} className="automation-text-link">
                        Ábrela
                      </Link>
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      {running.length > 0 ? (
        <PanelCard
          className="automation-activity-card" bodyPadding="none" headerDensity="compact"
          title="Tareas en curso"
          actions={<span className="automation-count">{running.length}</span>}
        >
          <ul className="automation-running-list">
            {running.map((run) => (
              <li key={run.id}>
                <Link href={`${base}/ejecuciones/${run.id}`} className="automation-approval-name">
                  {run.flow_name}
                </Link>
                <RunControls runId={run.id} status={run.status} workingText="Trabajando… Si necesita algo más, aparecerá arriba." />
              </li>
            ))}
          </ul>
        </PanelCard>
      ) : null}

      <PanelCard className="automation-activity-card" bodyPadding="none" headerDensity="compact" title="Avisos en este dispositivo">
        <div className="automation-notifications-content">
          <PushToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY?.trim() || null} />
        </div>
      </PanelCard>
    </div>
  )
}
