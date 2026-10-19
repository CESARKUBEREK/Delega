import Link from "next/link"
import { Suspense } from "react"
import { OPENAI_MODELS } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime, formatNumber } from "../format"

export const metadata = { title: "Historial" }

export default function HistoryPage({ params }: PageProps<"/w/[workspaceId]/historial">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="rotulo text-2xl">Historial</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Conversaciones con el asistente y consumo de IA de este espacio. Las ejecuciones de automatizaciones aparecerán aquí cuando
          estén disponibles.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
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

  const [{ data: conversations }, { data: usage }] = await Promise.all([
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
    <div className="flex flex-col gap-6">
      <section className="border border-ink bg-sheet">
        <h2 className="border-b border-ink px-5 py-3 font-semibold">
          Consumo de este mes {isAdmin ? "(todo el espacio)" : "(tuyo)"}
        </h2>
        {byModel.size > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-graphite">
                <tr className="border-b border-rule">
                  <th className="px-5 py-2 font-medium">Modelo</th>
                  <th className="px-5 py-2 text-right font-medium">Peticiones</th>
                  <th className="px-5 py-2 text-right font-medium">Tokens de entrada</th>
                  <th className="px-5 py-2 text-right font-medium">Tokens de salida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {[...byModel].map(([model, r]) => (
                  <tr key={model}>
                    <td className="px-5 py-2 text-ink">{OPENAI_MODELS.find((m) => m.id === model)?.label ?? model}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatNumber(r.requests)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatNumber(r.input)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{formatNumber(r.output)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-graphite">El importe lo factura OpenAI en tu cuenta según su tarifa.</p>
          </div>
        ) : (
          <p className="px-5 py-4 text-sm text-graphite">Sin consumo este mes.</p>
        )}
      </section>

      <section className="border border-ink bg-sheet">
        <h2 className="border-b border-ink px-5 py-3 font-semibold">
          Conversaciones {isAdmin ? "del espacio" : "tuyas"}
        </h2>
        {conversations && conversations.length > 0 ? (
          <ul className="divide-y divide-rule">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`${base}/asistente?c=${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-paper">
                  <span className="truncate text-ink">{c.title}</span>
                  <span className="shrink-0 text-sm text-graphite">{formatDateTime(c.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-graphite">Aún no hay conversaciones.</p>
        )}
      </section>
    </div>
  )
}
