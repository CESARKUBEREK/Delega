import Link from "next/link"
import { Suspense } from "react"
import { modelLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime, formatNumber } from "../format"
import { EmptyState, PageHeader, PanelCard, RunStatusBadge } from "@/components/ui"

export const metadata = { title: "Historial" }

export default function HistoryPage({ params }: PageProps<"/w/[workspaceId]/historial">) {
  return (
    <div className="automation-page flex flex-col">
      <PageHeader eyebrow="ACTIVIDAD DEL ESPACIO" title="Historial" description="Ejecuciones de automatizaciones, conversaciones con el asistente y consumo de IA de este espacio." />
      <Suspense fallback={<div className="automation-loading h-64 border border-rule bg-sheet" aria-busy="true" />}>
        <History params={params} />
      </Suspense>
    </div>
  )
}

async function History({ params }: { params: PageProps<"/w/[workspaceId]/historial">["params"] }) {
  const { workspaceId } = await params
  const { isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/historial`)
  const supabase = await createClient()

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  const [{ data: conversations }, { data: usage }, { data: runs }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("usage_events")
      .select("model, input_tokens, output_tokens")
      .eq("workspace_id", workspaceId)
      .gte("created_at", monthStart.toISOString())
      .limit(5000),
    supabase
      .from("flow_runs")
      .select("id, flow_name, status, started_at")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(50),
  ])

  const byModel = new Map<string, { requests: number; input: number; output: number }>()
  for (const u of usage ?? []) {
    const row = byModel.get(u.model) ?? { requests: 0, input: 0, output: 0 }
    row.requests += 1
    row.input += u.input_tokens
    row.output += u.output_tokens
    byModel.set(u.model, row)
  }
  const base = `/w/${workspaceId}`
  const requestCount = [...byModel.values()].reduce((total, row) => total + row.requests, 0)

  return (
    <div className="automation-history">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumen de actividad">
        <div className="rounded-xl border border-rule bg-sheet p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Ejecuciones recientes</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatNumber(runs?.length ?? 0)}</p>
          <p className="mt-1 text-xs text-graphite">Últimas 50 del espacio</p>
        </div>
        <div className="rounded-xl border border-rule bg-sheet p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Conversaciones recientes</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatNumber(conversations?.length ?? 0)}</p>
          <p className="mt-1 text-xs text-graphite">Últimas 100 del espacio</p>
        </div>
        <div className="rounded-xl border border-rule bg-sheet p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Peticiones de IA este mes</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{formatNumber(requestCount)}</p>
          <p className="mt-1 text-xs text-graphite">{formatNumber(byModel.size)} modelos utilizados</p>
        </div>
      </div>
      <PanelCard className="automation-activity-card history-panel" bodyPadding="none" headerDensity="compact" title="Últimas ejecuciones" description={isAdmin ? "Trabajo realizado en todo el espacio" : "Trabajo realizado por ti"}>
        {runs && runs.length > 0 ? (
          <ul className="automation-history-list">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/ejecuciones/${r.id}`} className="automation-history-run">
                  <span className="automation-history-main">
                    <span className="automation-history-title">{r.flow_name}</span>
                    <time dateTime={r.started_at}>{formatDateTime(r.started_at)}</time>
                  </span>
                  <RunStatusBadge status={r.status} className="automation-history-status" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aún no hay ejecuciones" description="Cuando una automatización se ejecute, su actividad aparecerá aquí." />
        )}
      </PanelCard>

      <PanelCard className="automation-activity-card history-panel" bodyPadding="none" headerDensity="compact" title="Consumo de este mes" description={isAdmin ? "Uso de IA en todo el espacio" : "Tu uso de IA"}>
        {byModel.size > 0 ? (
          <div className="automation-history-table-wrap">
            <table className="automation-history-table">
              <thead>
                <tr className="border-b border-rule">
                  <th>Modelo</th>
                  <th>Peticiones</th>
                  <th>Tokens de entrada</th>
                  <th>Tokens de salida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {[...byModel].map(([model, r]) => (
                  <tr key={model}>
                    <td>{modelLabel(model)}</td>
                    <td>{formatNumber(r.requests)}</td>
                    <td>{formatNumber(r.input)}</td>
                    <td>{formatNumber(r.output)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="automation-history-note">El importe lo factura cada proveedor (OpenAI, Anthropic, DeepSeek o xAI) en tu cuenta según su tarifa.</p>
          </div>
        ) : (
          <EmptyState title="Sin consumo este mes" description="Aquí verás las peticiones y los tokens utilizados por cada modelo." />
        )}
      </PanelCard>

      <PanelCard className="automation-activity-card history-panel" bodyPadding="none" headerDensity="compact" title="Conversaciones recientes" description={isAdmin ? "Conversaciones del espacio" : "Tus conversaciones"}>
        {conversations && conversations.length > 0 ? (
          <ul className="automation-history-list">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/asistente?c=${c.id}`} className="automation-history-run">
                  <span className="automation-history-main">
                    <span className="automation-history-title">{c.title}</span>
                    <time dateTime={c.updated_at}>{formatDateTime(c.updated_at)}</time>
                  </span>
                  <span className="automation-history-open" aria-hidden="true">Abrir <span>→</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aún no hay conversaciones" description="Las conversaciones que mantengas con MarchaSolo aparecerán aquí." />
        )}
      </PanelCard>
    </div>
  )
}
