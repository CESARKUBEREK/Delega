import Link from "next/link"
import { Suspense } from "react"
import { FLOW_STATUS_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { ROUTINES, type Routine, type RoutineTier, routineOfFlow, TIER_INFO } from "@/lib/templates"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "../format"

export const metadata = { title: "Automatizaciones" }

type FlowRow = { id: string; name: string; summary: string | null; status: string; updated_at: string; next_run_at: string | null; settings: unknown }

export default function FlowsPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones">) {
  return (
    <div className="automation-page flex flex-col gap-6">
      <header className="automation-page-intro">
        <p className="app-eyebrow">FLUJOS Y AGENTES</p>
        <h1 className="rotulo text-2xl">Automatizaciones</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Tus automatizaciones, ordenadas por las 10 rutinas del negocio. Se ejecutan a mano, a una hora fija o al llegar un correo o un mensaje de
          Telegram. Lo que escriban o envíen a otros espera tu aprobación.
        </p>
      </header>
      <Suspense fallback={<div className="h-48 border border-rule bg-sheet" aria-busy="true" />}>
        <FlowList params={params} />
      </Suspense>
    </div>
  )
}

async function FlowList({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones">["params"] }) {
  const { workspaceId } = await params
  await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones`)
  const supabase = await createClient()
  const { data } = await supabase
    .from("flows")
    .select("id, name, summary, status, updated_at, next_run_at, settings")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
  const flows = (data ?? []) as FlowRow[]
  const base = `/w/${workspaceId}`

  // Cada automatización va con su rutina; las que no salen de una plantilla,
  // en «Otras».
  const byRoutine = new Map<string, FlowRow[]>()
  const others: FlowRow[] = []
  for (const f of flows) {
    const r = routineOfFlow(f)
    if (r) byRoutine.set(r.id, [...(byRoutine.get(r.id) ?? []), f])
    else others.push(f)
  }
  const tiers: RoutineTier[] = ["personal", "negocio", "avanzado"]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`${base}/asistente`}
          className="automation-action-primary inline-flex h-11 items-center justify-center px-5 text-base font-semibold"
        >
          Pedírsela al asistente
        </Link>
        <Link
          href={`${base}/automatizaciones/nueva`}
          className="automation-action-secondary inline-flex h-11 items-center justify-center px-5 text-base font-semibold"
        >
          Crear desde cero
        </Link>
      </div>

      {flows.length === 0 ? (
        <div className="automation-empty-state">
          <p className="text-ink">Aún no hay automatizaciones en este espacio.</p>
          <p className="mt-1 text-sm text-graphite">Empieza por una de las rutinas de abajo: cada una tiene plantillas listas para usar.</p>
        </div>
      ) : null}

      {tiers.map((tier) => (
        <section key={tier} aria-labelledby={`tier-${tier}`} className="flex flex-col gap-3">
          <div>
            <h2 id={`tier-${tier}`} className="rotulo text-xl">
              {TIER_INFO[tier].title}
            </h2>
            <p className="text-sm text-graphite">{TIER_INFO[tier].promise}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {ROUTINES.filter((r) => r.tier === tier).map((r) => (
              <li key={r.id}>
                <RoutineGroup routine={r} flows={byRoutine.get(r.id) ?? []} base={base} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {others.length ? (
        <section aria-labelledby="otras" className="flex flex-col gap-3">
          <div>
            <h2 id="otras" className="rotulo text-xl">
              Otras automatizaciones
            </h2>
            <p className="text-sm text-graphite">Las que no pertenecen a ninguna rutina: creadas con el asistente, desde cero o con una plantilla de sector.</p>
          </div>
          <FlowRows flows={others} base={base} />
        </section>
      ) : null}
    </div>
  )
}

function RoutineGroup({ routine: r, flows, base }: { routine: Routine; flows: FlowRow[]; base: string }) {
  const catalog = `${base}/automatizaciones/plantillas#rutina-${r.id}`
  return (
    <article className="routine-card" aria-labelledby={`rutina-${r.id}-titulo`}>
      <header className="flex items-start gap-3">
        <span className="routine-number" aria-hidden="true">
          {String(r.number).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`rutina-${r.id}-titulo`} className="text-lg font-bold text-ink">
            {r.title}
          </h3>
          <p className="text-sm text-graphite">{r.problem}</p>
        </div>
      </header>

      {flows.length ? <FlowRows flows={flows} base={base} /> : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {r.link ? (
          <Link href={`${base}/${r.link.path}`} className="font-semibold text-link underline underline-offset-4">
            {r.link.label}
          </Link>
        ) : null}
        {r.templates.length ? (
          <Link href={catalog} className="font-semibold text-link underline underline-offset-4">
            {flows.length ? "Añadir otra plantilla" : r.templates.length === 1 ? "Ver la plantilla" : `Ver las ${r.templates.length} plantillas`}
          </Link>
        ) : null}
        {!flows.length && !r.link ? <span className="text-graphite">Aún no la usas.</span> : null}
      </div>
    </article>
  )
}

function FlowRows({ flows, base }: { flows: FlowRow[]; base: string }) {
  return (
    <ul className="automation-list divide-y divide-rule border border-ink bg-sheet">
      {flows.map((f) => (
        <li key={f.id}>
          <Link href={`${base}/automatizaciones/${f.id}`} className="automation-row flex items-start justify-between gap-4 px-5 py-4">
            <span className="min-w-0">
              <span className="block font-medium text-ink">{f.name}</span>
              {f.summary ? <span className="line-clamp-2 text-sm text-graphite">{f.summary}</span> : null}
            </span>
            <span className="shrink-0 text-right text-sm text-graphite">
              <span className="automation-row-status">{FLOW_STATUS_LABEL[f.status] ?? f.status}</span>
              {f.next_run_at ? <span className="block text-xs text-ink">Próxima: {formatDateTime(f.next_run_at)}</span> : null}
              <span className="text-xs">{formatDateTime(f.updated_at)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
