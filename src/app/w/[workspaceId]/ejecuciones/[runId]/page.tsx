import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { RUN_STATUS_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime, formatNumber } from "../../format"
import { asPending } from "@/lib/pending"
import { ApprovalCard, RunControls } from "./run-live"

export const metadata = { title: "Ejecución" }
// Cada tramo del agente puede tardar hasta ~90 s.
export const maxDuration = 120

export default function RunPage({ params }: PageProps<"/w/[workspaceId]/ejecuciones/[runId]">) {
  return (
    <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
      <Run params={params} />
    </Suspense>
  )
}

const EVENT_MARK: Record<string, string> = {
  started: "Inicio",
  tool: "Lectura",
  approval_requested: "Propuesta",
  approved: "Aprobado",
  rejected: "Rechazado",
  message: "Nota",
  error: "Aviso",
  finished: "Fin",
}

async function Run({ params }: { params: PageProps<"/w/[workspaceId]/ejecuciones/[runId]">["params"] }) {
  const { workspaceId, runId } = await params
  if (!UUID_RE.test(runId)) notFound()
  await getWorkspace(workspaceId, `/w/${workspaceId}/ejecuciones/${runId}`)
  const supabase = await createClient()

  const [{ data: run }, { data: events }] = await Promise.all([
    supabase
      .from("flow_runs")
      .select("id, flow_id, flow_name, status, pending_action, summary, error, tool_calls, input_tokens, output_tokens, started_at, finished_at, note, trigger")
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase.from("run_events").select("id, kind, title, created_at").eq("run_id", runId).eq("workspace_id", workspaceId).order("id"),
  ])
  if (!run) notFound()

  const base = `/w/${workspaceId}`
  const pending = run.status === "awaiting_approval" ? asPending(run.pending_action) : null
  const active = run.status === "running" || run.status === "awaiting_approval"
  const trigger = run.trigger as { type?: string; conversation_id?: unknown } | null
  const chat = trigger?.type === "chat" && typeof trigger.conversation_id === "string" && UUID_RE.test(trigger.conversation_id)
    ? { conversation_id: trigger.conversation_id }
    : null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          {run.flow_id ? (
            <Link href={`${base}/automatizaciones/${run.flow_id}`} className="text-link underline underline-offset-4">
              {run.flow_name}
            </Link>
          ) : chat ? (
            <Link href={`${base}/asistente?c=${chat.conversation_id}`} className="text-link underline underline-offset-4">
              {run.flow_name} (pedida en el chat)
            </Link>
          ) : (
            <span className="text-graphite">{run.flow_name} (automatización borrada)</span>
          )}
        </p>
        <h1 className="rotulo mt-2 text-2xl">Ejecución del {formatDateTime(run.started_at)}</h1>
        <p className="mt-1 text-sm text-graphite">
          {RUN_STATUS_LABEL[run.status] ?? run.status} · {run.tool_calls} acciones · {formatNumber(run.input_tokens + run.output_tokens)} tokens
        </p>
      </div>

      {pending ? <ApprovalCard runId={run.id} pending={pending} /> : null}

      {run.status === "succeeded" && run.summary ? (
        <section className="border border-ok bg-sheet">
          <h2 className="border-b border-ok px-5 py-3 font-semibold text-ok">Resultado</h2>
          <p className="px-5 py-4 whitespace-pre-wrap text-ink">{run.summary}</p>
        </section>
      ) : null}

      {run.status === "failed" && run.error ? (
        <p role="alert" className="border-l-2 border-alert bg-alert-bg px-4 py-3 text-sm text-alert">
          {run.error}
        </p>
      ) : null}

      {active ? <RunControls runId={run.id} status={run.status} /> : null}

      <section className="border border-ink bg-sheet">
        <h2 className="border-b border-ink px-5 py-3 font-semibold">Bitácora</h2>
        <ol className="divide-y divide-rule">
          {(events ?? []).map((e) => (
            <li key={e.id} className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-3 px-5 py-2.5 text-sm">
              <span className={`text-xs font-medium ${e.kind === "error" || e.kind === "rejected" ? "text-alert" : e.kind === "approved" || e.kind === "finished" ? "text-ok" : "text-graphite"}`}>
                {EVENT_MARK[e.kind] ?? e.kind}
              </span>
              <span className="text-ink">{e.title}</span>
              <span className="text-xs text-graphite">{formatDateTime(e.created_at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {run.note ? <p className="text-sm text-graphite">Indicaciones: {run.note}</p> : null}
      {(run.trigger as { type?: string; text?: string } | null)?.type === "telegram_message" ? (
        <p className="border-l-2 border-rule pl-3 text-sm text-graphite">
          Mensaje de Telegram que la lanzó: «{String((run.trigger as { text?: string }).text ?? "").slice(0, 500)}»
        </p>
      ) : null}
      {(run.trigger as { type?: string } | null)?.type === "email_message" ? (
        <p className="border-l-2 border-rule pl-3 text-sm text-graphite">
          {(() => {
            const t = run.trigger as { name?: string | null; address?: string; subject?: string }
            return `Correo que la lanzó: de ${t.name || t.address || "un remitente"}${t.subject ? `, «${t.subject.slice(0, 200)}»` : ""}`
          })()}
        </p>
      ) : null}
    </div>
  )
}
