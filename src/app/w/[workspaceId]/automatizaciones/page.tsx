import Link from "next/link"
import { Suspense } from "react"
import { asPlan, FLOW_STATUS_LABEL, RUN_STATUS_LABEL, TRIGGER_LABEL } from "@/lib/plan"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { findTemplate, ROUTINES, type Routine, type RoutineTier, routineOfFlow, TIER_INFO, verticalOfFlow } from "@/lib/templates"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { HelpPanel } from "@/components/help-panel"
import { EmptyState, PageHeader, PanelCard, RunStatusBadge } from "@/components/ui"

export const metadata = { title: "Automatizaciones" }

type FlowRow = {
  id: string
  name: string
  summary: string | null
  status: string
  updated_at: string
  next_run_at: string | null
  settings: Json | null
  definition: Json
}

type RunRow = { id: string; flow_id: string | null; flow_name: string; status: string; started_at: string; summary: string | null }

const ROUTINE_ICONS: Record<string, string> = {
  bandeja: "M3 7h18v13H3z M3 8l9 6 9-6 M7 4h10",
  secretaria: "M4 5h16v15H4z M8 3v4m8-4v4M4 10h16 M8 14h3m2 0h3m-8 3h3",
  agenda: "M4 5h16v15H4z M8 3v4m8-4v4M4 10h16 M8 14h2m4 0h2m-8 3h2",
  tareas: "M9 6h11M9 12h11M9 18h11 M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  seguimiento: "M4 19V5m0 14h16 M7 15l4-4 3 2 5-7 M15 6h4v4",
  presupuestos: "M6 3h8l5 5v13H6z M14 3v6h5 M9 13h7m-7 4h7",
  informes: "M4 20V4m0 16h17 M8 16v-5m5 5V7m5 9V3",
  redes: "M4 5h16v12H9l-5 4z M8 9h8m-8 4h5",
  facturas: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6m-6 4h6",
  recepcionista: "M4 13v-2a8 8 0 0 1 16 0v2 M4 13h3v6H6a2 2 0 0 1-2-2zm16 0h-3v6h1a2 2 0 0 0 2-2z M10 21h4",
}

export default function FlowsPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones">) {
  return (
    <div className="automation-page flex flex-col gap-6">
      <PageHeader
        eyebrow="TU EQUIPO DIGITAL"
        title="Automatizaciones"
        description={<>Tus automatizaciones, organizadas por las rutinas de tu negocio. Puedes ejecutarlas cuando quieras, programarlas o activarlas cuando recibas un mensaje. Lo que escriban o envíen a otros espera tu aprobación.</>}
      />
      <Suspense fallback={<div className="automation-loading h-48 border border-rule bg-sheet" aria-busy="true" />}>
        <FlowList params={params} />
      </Suspense>
    </div>
  )
}

async function FlowList({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones">["params"] }) {
  const { workspaceId } = await params
  await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones`)
  const supabase = await createClient()
  const [{ data }, { data: recentRuns }, { data: pendingRuns }] = await Promise.all([
    supabase
      .from("flows")
      .select("id, name, summary, status, updated_at, next_run_at, settings, definition")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("flow_runs")
      .select("id, flow_id, flow_name, status, started_at, summary")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("flow_runs")
      .select("id, flow_name, started_at, summary")
      .eq("workspace_id", workspaceId)
      .eq("status", "awaiting_approval")
      .order("started_at", { ascending: false })
      .limit(5),
  ])
  const flows = (data ?? []) as FlowRow[]
  const activity = (recentRuns ?? []) as RunRow[]
  const pending = pendingRuns ?? []
  const base = `/w/${workspaceId}`
  const latestRunByFlow = new Map<string, RunRow>()
  for (const run of activity) {
    if (run.flow_id && !latestRunByFlow.has(run.flow_id)) latestRunByFlow.set(run.flow_id, run)
  }
  const tiers: RoutineTier[] = ["personal", "negocio", "avanzado"]
  const flowGroups = ["active", "paused", "draft"].map((status) => ({
    status,
    flows: flows.filter((flow) => flow.status === status),
  }))
  const knownFlowIds = new Set(flowGroups.flatMap((group) => group.flows.map((flow) => flow.id)))
  const ungroupedFlows = flows.filter((flow) => !knownFlowIds.has(flow.id))

  return (
    <div className="flex flex-col gap-8">
      <HelpPanel workspaceId={workspaceId} page="automatizaciones" />

      <section className="automation-start" aria-labelledby="automation-start-title">
        <div>
          <p className="automation-section-eyebrow">EMPIEZA POR LO QUE NECESITAS</p>
          <h2 id="automation-start-title">¿Cómo quieres empezar?</h2>
        </div>
        <div className="automation-actions">
          <Link href={`${base}/asistente`} className="automation-action-primary">
            <span className="automation-action-title">Pedirle una automatización a MarchaSolo</span>
            <span className="automation-action-copy">Describe lo que necesitas. El asistente la prepara.</span>
            <span className="automation-action-arrow" aria-hidden="true">→</span>
          </Link>
          <Link href={`${base}/automatizaciones/nueva`} className="automation-action-secondary">
            <span className="automation-action-title">Crear desde cero</span>
            <span className="automation-action-copy">Diseña tu propio flujo.</span>
          </Link>
          <Link href={`${base}/automatizaciones/plantillas#por-sector`} className="automation-action-secondary">
            <span className="automation-action-title">Explorar por sector</span>
            <span className="automation-action-copy">Encuentra soluciones para tu actividad.</span>
          </Link>
        </div>
      </section>

      {!flows.length ? (
        <EmptyState
          title="Tu equipo digital está listo para empezar."
          description="Elige una rutina de tu negocio y MarchaSolo te propondrá automatizaciones que puedes utilizar inmediatamente."
          action={<a href="#rutinas" className="automation-empty-link">Explorar las rutinas <span aria-hidden="true">↓</span></a>}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h4l2-7 4 14 2-7h4" /></svg>}
        />
      ) : (
        <section className="automation-owned" aria-labelledby="automation-owned-title">
          <div className="automation-section-heading">
            <div>
              <p className="automation-section-eyebrow">TUS FLUJOS CREADOS</p>
              <h2 id="automation-owned-title">Tus automatizaciones</h2>
            </div>
            <span className="automation-count">{flows.length} {flows.length === 1 ? "automatización" : "automatizaciones"}</span>
          </div>
          <div className="automation-flow-groups">
            {flowGroups.map((group) => group.flows.length ? (
              <section key={group.status} className="automation-flow-group" aria-labelledby={`flows-${group.status}`}>
                <h3 id={`flows-${group.status}`}>
                  {FLOW_STATUS_LABEL[group.status] ?? group.status}
                  <span>{group.flows.length}</span>
                </h3>
                <FlowRows flows={group.flows} base={base} latestRunByFlow={latestRunByFlow} />
              </section>
            ) : null)}
            {ungroupedFlows.length ? (
              <section className="automation-flow-group" aria-labelledby="flows-other">
                <h3 id="flows-other">Otras <span>{ungroupedFlows.length}</span></h3>
                <FlowRows flows={ungroupedFlows} base={base} latestRunByFlow={latestRunByFlow} />
              </section>
            ) : null}
          </div>
        </section>
      )}

      <section id="rutinas" className="automation-routines" aria-labelledby="automation-routines-title">
        <div className="automation-section-heading">
          <div>
            <p className="automation-section-eyebrow">CATÁLOGO DE CAPACIDADES</p>
            <h2 id="automation-routines-title">Rutinas de tu negocio</h2>
            <p>Explora áreas de trabajo y sus plantillas para elegir qué poner en marcha.</p>
          </div>
          <Link href={`${base}/automatizaciones/plantillas`} className="automation-text-link">Ver todas las plantillas <span aria-hidden="true">→</span></Link>
        </div>
        <div className="automation-tier-list">
          {tiers.map((tier) => (
            <section key={tier} aria-labelledby={`tier-${tier}`} className="automation-tier">
              <div className="automation-tier-heading">
                <h3 id={`tier-${tier}`}>{TIER_INFO[tier].title}</h3>
                <p>{TIER_INFO[tier].promise}</p>
              </div>
              <ul className="automation-routine-grid">
                {ROUTINES.filter((routine) => routine.tier === tier).map((routine) => (
                  <li key={routine.id}>
                    <RoutineCard routine={routine} base={base} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      {activity.length || pending.length ? (
        <section className="automation-activity" aria-labelledby="automation-activity-title">
          <div className="automation-section-heading">
            <div>
              <p className="automation-section-eyebrow">LO QUE ESTÁ PASANDO</p>
              <h2 id="automation-activity-title">Actividad reciente</h2>
            </div>
          </div>
          <div className="automation-activity-grid">
            <PanelCard className="automation-activity-card" bodyPadding="none" headerDensity="compact" title="Ejecuciones" actions={<Link href={`${base}/historial`}>Ver historial <span aria-hidden="true">→</span></Link>}>
              {activity.length ? (
                <ul className="automation-activity-list">
                  {activity.map((run) => (
                    <li key={run.id}>
                      <Link href={`${base}/ejecuciones/${run.id}`}>
                        <span className="automation-activity-name">{run.flow_name}</span>
                        <RunStatusBadge status={run.status} className="automation-activity-status" />
                        <time dateTime={run.started_at}>{formatDateTime(run.started_at)}</time>
                        {run.summary ? <span className="automation-activity-summary">{run.summary}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="automation-activity-empty">Aún no se ha ejecutado ninguna automatización.</p>
              )}
            </PanelCard>
            <PanelCard className="automation-activity-card" bodyPadding="none" headerDensity="compact" title="Por revisar" actions={<Link href={`${base}/aprobaciones`}>Ir a Aprobaciones <span aria-hidden="true">→</span></Link>}>
              {pending.length ? (
                <ul className="automation-activity-list">
                  {pending.map((run) => (
                    <li key={run.id}>
                      <Link href={`${base}/ejecuciones/${run.id}`}>
                        <span className="automation-activity-name">{run.flow_name}</span>
                        <RunStatusBadge status="awaiting_approval" className="automation-activity-status" />
                        <time dateTime={run.started_at}>{formatDateTime(run.started_at)}</time>
                        {run.summary ? <span className="automation-activity-summary">{run.summary}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="automation-activity-empty">No tienes aprobaciones pendientes.</p>
              )}
            </PanelCard>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function RoutineCard({ routine, base }: { routine: Routine; base: string }) {
  const templateCount = routine.templates.filter((id) => findTemplate(id)).length
  return (
    <article className="automation-routine-card" aria-labelledby={`routine-${routine.id}-title`}>
      <div className="automation-routine-card-heading">
        <span className="automation-routine-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={ROUTINE_ICONS[routine.id] ?? "M4 12h16M12 4v16"} />
          </svg>
        </span>
        <span className="automation-routine-number">{String(routine.number).padStart(2, "0")}</span>
      </div>
      <div className="automation-routine-copy">
        <h4 id={`routine-${routine.id}-title`}>{routine.title}</h4>
        <p>{routine.auto}</p>
      </div>
      <div className="automation-routine-footer">
        <span>{templateCount} {templateCount === 1 ? "plantilla" : "plantillas"}</span>
        {templateCount ? (
          <Link href={`${base}/automatizaciones/plantillas#rutina-${routine.id}`}>
            Explorar {templateCount === 1 ? "plantilla" : `${templateCount} plantillas`} <span aria-hidden="true">→</span>
          </Link>
        ) : routine.link ? (
          <Link href={`${base}/${routine.link.path}`}>{routine.link.label} <span aria-hidden="true">→</span></Link>
        ) : null}
      </div>
    </article>
  )
}

function FlowRows({
  flows,
  base,
  latestRunByFlow,
}: {
  flows: FlowRow[]
  base: string
  latestRunByFlow: Map<string, RunRow>
}) {
  return (
    <ul className="automation-flow-grid">
      {flows.map((flow) => {
        const plan = asPlan(flow.definition)
        const routine = routineOfFlow(flow)
        const vertical = routine ? undefined : verticalOfFlow(flow)
        const latestRun = latestRunByFlow.get(flow.id)
        const status = FLOW_STATUS_LABEL[flow.status] ?? flow.status
        return (
          <li key={flow.id}>
            <Link href={`${base}/automatizaciones/${flow.id}`} className="automation-flow-card">
              <span className="automation-flow-topline">
                <span className={`automation-flow-status is-${flow.status}`}>{status}</span>
                {latestRun?.status === "failed" ? <span className="automation-flow-attention">Última ejecución con error</span> : null}
              </span>
              <strong>{flow.name}</strong>
              {flow.summary ? <span className="automation-flow-summary">{flow.summary}</span> : null}
              <span className="automation-flow-meta">
                <span>{routine?.title ?? vertical?.title ?? "Creada desde cero"}</span>
                <span>{TRIGGER_LABEL[plan?.trigger.type ?? "manual"] ?? "Manual"}</span>
              </span>
              <span className="automation-flow-dates">
                {latestRun ? <span>Última: {formatDateTime(latestRun.started_at)}</span> : null}
                {flow.next_run_at ? <span>Próxima: {formatDateTime(flow.next_run_at)}</span> : null}
              </span>
              <span className="automation-flow-open">Abrir automatización <span aria-hidden="true">→</span></span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
