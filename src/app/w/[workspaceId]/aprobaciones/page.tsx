import Link from "next/link"
import { Suspense } from "react"
import { runOrigin } from "@/lib/labels"
import { asPending } from "@/lib/pending"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { ApprovalCard, RunControls } from "../ejecuciones/[runId]/run-live"
import { formatDateTime } from "../format"
import { PushToggle } from "../push-toggle"
import { EmptyState, PageHeader, PanelCard, RunStatusBadge } from "@/components/ui"

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
  const total = waiting.length + running.length

  return (
    <div className="automation-page flex flex-col gap-6">
      <PageHeader
        eyebrow="TU CONTROL, SIEMPRE"
        title="Aprobaciones"
        description="Tú decides qué puede hacer MarchaSolo con tus aplicaciones y tus datos."
      />

      <section className="grid gap-3 rounded-2xl border border-rule bg-sheet p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5" aria-label="Resumen de supervisión">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--turquesa-soft)] text-[var(--link)]" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M12 3 4.5 6v5.2c0 4.6 3.1 7.9 7.5 9.8 4.4-1.9 7.5-5.2 7.5-9.8V6L12 3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-ink">Tú tienes la última palabra</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-graphite">
              Antes de escribir, enviar o modificar información, puedes revisar los detalles y aprobar o rechazar cada acción.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end" aria-live="polite">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--warning-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)]">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {waiting.length} {waiting.length === 1 ? "por revisar" : "por revisar"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--neutral-state-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--neutral-state)]">
            {running.length} {running.length === 1 ? "en curso" : "en curso"}
          </span>
        </div>
      </section>

      {total === 0 ? (
        <EmptyState
          title="No tienes decisiones pendientes"
          description="Todo está al día. Cuando una tarea necesite tu autorización, aparecerá aquí con el contenido y los cambios que propone."
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>}
        />
      ) : null}

      <section className="automation-approvals" aria-labelledby="approvals-pending-title">
        <div className="automation-section-heading">
          <div>
            <p className="automation-section-eyebrow">TU DECISIÓN</p>
            <h2 id="approvals-pending-title">Necesitan tu revisión</h2>
            <p className="mt-1 text-sm text-graphite">Comprueba qué se hará y con qué información antes de autorizarlo.</p>
          </div>
          <span className="automation-count" aria-label={`${waiting.length} acciones pendientes`}>{waiting.length}</span>
        </div>

        {waiting.length > 0 ? (
          <div className="automation-approval-list">
            {waiting.map((run) => {
              const pending = asPending(run.pending_action)
              return (
                <article key={run.id} className="automation-approval-item">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`${base}/ejecuciones/${run.id}`} className="automation-approval-name">
                        {run.flow_name}
                      </Link>
                      <RunStatusBadge status={run.status} />
                    </div>
                    <p className="automation-approval-meta">
                      <span>{runOrigin(run.trigger)}</span>
                      <time dateTime={run.started_at}>{formatDateTime(run.started_at)}</time>
                    </p>
                  </div>
                  {pending ? (
                    <ApprovalCard runId={run.id} pending={pending} />
                  ) : (
                    <p className="automation-approval-unavailable">
                      No podemos mostrar el detalle de esta acción de forma segura aquí.{" "}
                      <Link href={`${base}/ejecuciones/${run.id}`} className="automation-text-link">
                        Revisar ejecución
                      </Link>
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-rule bg-sheet px-4 py-5">
            <p className="text-sm font-medium text-ink">No hay nada que aprobar ahora.</p>
            <p className="mt-1 text-sm text-graphite">Las acciones que requieran tu permiso aparecerán en esta sección.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="approvals-running-title">
        <PanelCard
          className="automation-activity-card" bodyPadding="none" headerDensity="compact"
          title={<span id="approvals-running-title">Tareas en curso</span>}
          description="MarchaSolo está trabajando. Si necesita tu autorización, la tarea aparecerá arriba."
          actions={<span className="automation-count">{running.length}</span>}
        >
          {running.length > 0 ? (
            <ul className="automation-running-list">
              {running.map((run) => (
                <li key={run.id}>
                  <Link href={`${base}/ejecuciones/${run.id}`} className="automation-approval-name">
                    {run.flow_name}
                  </Link>
                  <RunControls runId={run.id} status={run.status} workingText="Trabajando… Si necesita algo más, aparecerá en tus revisiones." />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-graphite">No hay tareas ejecutándose en este momento.</p>
          )}
        </PanelCard>
      </section>

      <PanelCard className="automation-activity-card" bodyPadding="none" headerDensity="compact" title="Avisos en este dispositivo">
        <div className="automation-notifications-content">
          <PushToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY?.trim() || null} />
        </div>
      </PanelCard>
    </div>
  )
}
