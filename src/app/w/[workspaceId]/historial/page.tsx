import Link from "next/link"
import { Suspense } from "react"
import { modelLabel, RUN_STATUS_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime, formatNumber } from "../format"

export const metadata = { title: "Historial" }

export default function HistoryPage({ params }: PageProps<"/w/[workspaceId]/historial">) {
  return (
    <div className="automation-page flex flex-col">
      <header className="automation-page-intro">
        <p className="app-eyebrow">ACTIVIDAD DEL ESPACIO</p>
        <h1 className="rotulo">Historial</h1>
        <p className="automation-page-description">
          Ejecuciones de automatizaciones, conversaciones con el asistente y consumo de IA de este espacio.
        </p>
      </header>
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

  return (
    <div className="automation-history">
      <section className="automation-activity-card">
        <div className="automation-activity-card-heading">
          <div>
            <p className="automation-section-eyebrow">TRABAJO REALIZADO</p>
            <h2>Últimas ejecuciones {isAdmin ? "del espacio" : "tuyas"}</h2>
          </div>
        </div>
        {runs && runs.length > 0 ? (
          <ul className="automation-history-list">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/ejecuciones/${r.id}`} className="automation-history-run">
                  <span className="automation-history-main">
                    <span className="automation-history-title">{r.flow_name}</span>
                    <time dateTime={r.started_at}>{formatDateTime(r.started_at)}</time>
                  </span>
                  <span
                    className={`automation-history-status is-${r.status}`}
                  >
                    {RUN_STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="automation-history-empty">Aún no se ha ejecutado ninguna automatización.</p>
        )}
      </section>

      <section className="automation-activity-card">
        <div className="automation-activity-card-heading">
          <div>
            <p className="automation-section-eyebrow">USO DE IA</p>
            <h2>Consumo de este mes {isAdmin ? "(todo el espacio)" : "(tuyo)"}</h2>
          </div>
        </div>
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
          <p className="automation-history-empty">Sin consumo este mes.</p>
        )}
      </section>

      <section className="automation-activity-card">
        <div className="automation-activity-card-heading">
          <div>
            <p className="automation-section-eyebrow">CHAT CON MARCHASOLO</p>
            <h2>Conversaciones recientes {isAdmin ? "del espacio" : "tuyas"}</h2>
          </div>
        </div>
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
          <p className="automation-history-empty">Aún no hay conversaciones.</p>
        )}
      </section>
    </div>
  )
}
