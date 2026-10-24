import Link from "next/link"
import { Suspense } from "react"
import { asPending } from "@/lib/pending"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { ApprovalCard, RunControls } from "../ejecuciones/[runId]/run-live"
import { formatDateTime } from "../format"
import { PushToggle } from "../push-toggle"

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

function origin(trigger: unknown): string {
  const type = (trigger as { type?: string } | null)?.type
  if (type === "chat") return "Pedida en el chat"
  if (type === "telegram_message") return "Lanzada por un mensaje de Telegram"
  return "Automatización"
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="rotulo text-2xl">Aprobaciones</h1>
        <p className="mt-1 text-sm text-graphite">
          Todo lo que el asistente quiere escribir o enviar espera aquí. Revísalo antes de aprobarlo.
        </p>
      </div>

      {waiting.length === 0 && running.length === 0 ? (
        <p className="border border-rule bg-sheet px-5 py-4 text-graphite">
          No hay nada pendiente. Cuando una tarea quiera escribir o enviar algo, aparecerá aquí.
        </p>
      ) : null}

      {waiting.map((run) => {
        const pending = asPending(run.pending_action)
        return (
          <article key={run.id} className="flex flex-col gap-2">
            <p className="text-sm text-graphite">
              <Link href={`${base}/ejecuciones/${run.id}`} className="font-medium text-link underline underline-offset-4">
                {run.flow_name}
              </Link>{" "}
              · {origin(run.trigger)} · {formatDateTime(run.started_at)}
            </p>
            {pending ? (
              <ApprovalCard runId={run.id} pending={pending} />
            ) : (
              <p className="border border-rule bg-sheet px-4 py-3 text-sm text-graphite">
                Esta acción no se puede mostrar aquí.{" "}
                <Link href={`${base}/ejecuciones/${run.id}`} className="text-link underline underline-offset-4">
                  Ábrela
                </Link>
                .
              </p>
            )}
          </article>
        )
      })}

      {running.length > 0 ? (
        <section className="border border-ink bg-sheet">
          <h2 className="border-b border-ink px-5 py-3 font-semibold">En curso</h2>
          <ul className="divide-y divide-rule">
            {running.map((run) => (
              <li key={run.id} className="flex flex-col gap-2 px-5 py-3">
                <Link href={`${base}/ejecuciones/${run.id}`} className="text-ink underline-offset-4 hover:underline">
                  {run.flow_name}
                </Link>
                <RunControls runId={run.id} status={run.status} workingText="Trabajando… Si necesita algo más, aparecerá arriba." />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border border-ink bg-sheet">
        <h2 className="border-b border-ink px-5 py-3 font-semibold">Avisos en este dispositivo</h2>
        <div className="px-5 py-4">
          <PushToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY?.trim() || null} />
        </div>
      </section>
    </div>
  )
}
