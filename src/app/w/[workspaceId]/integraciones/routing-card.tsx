import { formatUsd, MODE_LABEL, readWorkspaceRouting, TASK_LABEL } from "@/lib/router"
import { modelLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { RoutingForm } from "./routing-form"

// Router de IA (fase 8): cómo elige MarchaSolo el modelo en cada tarea, el
// presupuesto y lo gastado este mes (estimado con los precios oficiales).
export async function RoutingCard({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const supabase = await createClient()
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [{ data: ws }, { data: prices }, spend, breakdown] = await Promise.all([
    supabase.from("workspaces").select("ai_routing").eq("id", workspaceId).maybeSingle(),
    supabase.from("llm_models").select("prices_updated_at").order("prices_updated_at", { ascending: true }).limit(1),
    isAdmin ? supabase.rpc("ai_spend", { p_workspace_id: workspaceId }) : Promise.resolve({ data: null }),
    isAdmin ? supabase.rpc("ai_spend_breakdown", { p_workspace_id: workspaceId, p_since: monthStart.toISOString() }) : Promise.resolve({ data: null }),
  ])
  const routing = readWorkspaceRouting(ws?.ai_routing)
  const day = Number(spend.data?.[0]?.day_usd ?? 0)
  const month = Number(spend.data?.[0]?.month_usd ?? 0)
  const rows = (breakdown.data ?? []).map((r) => ({ ...r, cost_usd: Number(r.cost_usd), calls: Number(r.calls) }))
  const byModel = aggregate(rows, (r) => r.model)
  const byTask = aggregate(rows, (r) => r.task)
  const pricesDate = prices?.[0]?.prices_updated_at
  const pct = routing.monthlyUsd ? Math.min(100, Math.round((month / routing.monthlyUsd) * 100)) : null

  return (
    <details data-help="llm" name="integrations" className="integration-accordion border border-ink bg-sheet">
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">Cómo elige la IA</h3>
          <p className="text-sm text-graphite">
            MarchaSolo elige el modelo de cada tarea con las IAs que conectes: el económico para lo sencillo y uno mejor cuando hace falta, con
            respaldo si un proveedor falla y dentro de tu presupuesto.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="border border-stroke px-2 py-0.5 text-xs text-ink">{MODE_LABEL[routing.mode]}</span>
          {isAdmin && month > 0 ? <span className="text-xs text-graphite">{formatUsd(month)} este mes</span> : null}
        </div>
      </summary>

      <div className="flex flex-col gap-6 px-5 py-5">
        {isAdmin ? (
          <section className="flex flex-col gap-2 text-sm">
            <h4 className="font-semibold text-ink">Gasto estimado</h4>
            <p className="text-graphite">
              Hoy <span className="font-medium text-ink">{formatUsd(day)}</span> · este mes <span className="font-medium text-ink">{formatUsd(month)}</span>
              {routing.monthlyUsd ? (
                <>
                  {" "}de {formatUsd(routing.monthlyUsd)} ({pct} %)
                </>
              ) : null}
              . Días y meses en hora UTC.
            </p>
            {pct !== null ? (
              <div className="h-2 w-full max-w-md bg-paper" aria-hidden="true">
                <div className={`h-2 ${pct >= 100 ? "bg-alert" : pct >= 80 ? "bg-coral" : "bg-ok"}`} style={{ width: `${pct}%` }} />
              </div>
            ) : null}
            {rows.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <SpendTable title="Por modelo" rows={byModel.map((r) => ({ label: modelLabel(r.key), ...r }))} />
                <SpendTable title="Por tarea" rows={byTask.map((r) => ({ label: TASK_LABEL[r.key] ?? r.key, ...r }))} />
              </div>
            ) : (
              <p className="text-graphite">Aún no hay consumo este mes.</p>
            )}
            <p className="text-xs text-graphite">
              Estimación con los tokens que informa cada proveedor y sus precios oficiales{pricesDate ? ` del ${formatDay(pricesDate)}` : ""}. La factura que
              vale es la de tu cuenta de cada proveedor. Los créditos de prueba no cuentan.
            </p>
          </section>
        ) : null}

        {isAdmin ? (
          <RoutingForm workspaceId={workspaceId} routing={routing} />
        ) : (
          <p className="text-sm text-graphite">
            Modo: <span className="font-medium text-ink">{MODE_LABEL[routing.mode]}</span>. Solo un administrador puede cambiarlo y ver el gasto.
          </p>
        )}
      </div>
    </details>
  )
}

type Row = { model: string; task: string; calls: number; cost_usd: number }

function aggregate(rows: Row[], key: (r: Row) => string) {
  const map = new Map<string, { key: string; calls: number; cost: number }>()
  for (const r of rows) {
    const k = key(r)
    const cur = map.get(k) ?? { key: k, calls: 0, cost: 0 }
    cur.calls += r.calls
    cur.cost += r.cost_usd
    map.set(k, cur)
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost).slice(0, 8)
}

function SpendTable({ title, rows }: { title: string; rows: { label: string; calls: number; cost: number }[] }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="pb-1 text-left text-xs font-semibold uppercase tracking-wide text-graphite">{title}</caption>
      <tbody className="divide-y divide-rule">
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-1 pr-2 text-ink">{r.label}</td>
            <td className="py-1 pr-2 text-right text-graphite">{r.calls.toLocaleString("es-ES")} llamadas</td>
            <td className="py-1 text-right font-medium text-ink">{formatUsd(r.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
  return `${d} de ${months[m - 1]} de ${y}`
}
