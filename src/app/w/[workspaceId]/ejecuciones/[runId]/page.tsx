import Link from "next/link"
import { runOrigin } from "@/lib/labels"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { modelLabel, RUN_STATUS_LABEL } from "@/lib/plan"
import { costUsd, FALLBACK_CATALOG, formatUsd, isMode, MODE_LABEL, type ModelInfo, toModelInfo } from "@/lib/router"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime, formatNumber } from "../../format"
import { asPending } from "@/lib/pending"
import { ApprovalCard, RunControls } from "./run-live"
import { HelpPanel } from "@/components/help-panel"
import { HELP_GUIDES } from "@/lib/help"
import { diagnoseRun, type LiveStatus } from "@/lib/run-diagnosis"
import { SOLO_UPGRADE_IS_EXTERNAL, SOLO_UPGRADE_URL } from "@/lib/upgrade"
import { DiagnosisActions } from "./diagnosis"
import { PageHeader, PanelCard } from "@/components/ui"

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

  const [{ data: run }, { data: events }, { data: calls }, { data: models }] = await Promise.all([
    supabase
      .from("flow_runs")
      .select("id, flow_id, flow_name, status, pending_action, summary, error, tool_calls, input_tokens, output_tokens, started_at, finished_at, note, trigger, model, routing, routing_mode, cost_usd, budget_usd")
      .eq("id", runId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase.from("run_events").select("id, kind, title, detail, created_at").eq("run_id", runId).eq("workspace_id", workspaceId).order("id"),
    supabase
      .from("usage_events")
      .select("model, input_tokens, output_tokens, cached_tokens, cache_write_tokens, cost_usd, latency_ms")
      .eq("run_id", runId)
      .eq("workspace_id", workspaceId),
    supabase.from("llm_models").select("*"),
  ])
  if (!run) notFound()

  const base = `/w/${workspaceId}`
  const pending = run.status === "awaiting_approval" ? asPending(run.pending_action) : null
  const active = run.status === "running" || run.status === "awaiting_approval"
  const trigger = run.trigger as { type?: string; conversation_id?: unknown } | null
  const chat = trigger?.type === "chat" && typeof trigger.conversation_id === "string" && UUID_RE.test(trigger.conversation_id)
    ? { conversation_id: trigger.conversation_id }
    : null
  const trialFunded = (run.routing as { trial?: unknown } | null)?.trial === true

  return (
    <div className="flex flex-col gap-6">
      <HelpPanel workspaceId={workspaceId} page="ejecucion" runId={run.id} />
      {trialFunded ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Esta ejecución está financiada por MarchaSolo. Incluye una única prueba gratuita, con un límite de coste de IA de 0,10 USD.
        </p>
      ) : null}
      <PageHeader eyebrow={run.flow_id ? <Link href={`${base}/automatizaciones/${run.flow_id}`} className="text-link underline underline-offset-4">{run.flow_name}</Link> : chat ? <Link href={`${base}/asistente?c=${chat.conversation_id}`} className="text-link underline underline-offset-4">{run.flow_name} (pedida en el chat)</Link> : <span className="text-graphite">{run.flow_name} (automatización borrada)</span>} title={<>Ejecución del {formatDateTime(run.started_at)}</>} description={<span className="text-sm text-graphite">
          {RUN_STATUS_LABEL[run.status] ?? run.status} · {runOrigin(run.trigger)} · {run.tool_calls} acciones · {formatNumber(run.input_tokens + run.output_tokens)} tokens
        </span>} />

      {pending ? <ApprovalCard runId={run.id} pending={pending} /> : null}

      {run.status === "succeeded" && run.summary ? (
        <PanelCard className="run-detail-card is-success" bodyPadding="none" headerDensity="compact" title="Resultado">
          <p className="px-5 py-4 whitespace-pre-wrap text-ink">{run.summary}</p>
        </PanelCard>
      ) : null}

      {run.status === "failed" ? <Diagnosis workspaceId={workspaceId} flowId={run.flow_id} error={run.error} /> : null}

      {active ? <RunControls runId={run.id} status={run.status} /> : null}

      <RunAi run={run} calls={calls ?? []} models={models ?? []} />

      <PanelCard className="run-detail-card" bodyPadding="none" headerDensity="compact" title="Bitácora">
        <ol className="divide-y divide-rule">
          {(events ?? []).map((e) => (
            <li key={e.id} className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-3 px-5 py-2.5 text-sm">
              <span className={`text-xs font-medium ${e.kind === "error" || e.kind === "rejected" ? "text-alert" : e.kind === "approved" || e.kind === "finished" ? "text-ok" : "text-graphite"}`}>
                {EVENT_MARK[e.kind] ?? e.kind}
              </span>
              <span className="text-ink">
                {e.title}
                {noticeText(e.detail) ? (
                  <span className="mt-1.5 block whitespace-pre-wrap border-l-2 border-link pl-3 text-ink">{noticeText(e.detail)}</span>
                ) : null}
              </span>
              <span className="text-xs text-graphite">{formatDateTime(e.created_at)}</span>
            </li>
          ))}
        </ol>
      </PanelCard>

      {run.note ? <p className="text-sm text-graphite">Indicaciones: {run.note}</p> : null}
      {(run.trigger as { type?: string; text?: string } | null)?.type === "telegram_message" ? (
        <p className="border-l-2 border-rule pl-3 text-sm text-graphite">
          Mensaje de Telegram que la lanzó: «{String((run.trigger as { text?: string }).text ?? "").slice(0, 500)}»
        </p>
      ) : null}
      {(run.trigger as { type?: string } | null)?.type === "whatsapp_message" ? (
        <p className="border-l-2 border-rule pl-3 text-sm text-graphite">
          {(() => {
            const t = run.trigger as { name?: string | null; phone?: string; text?: string }
            return `WhatsApp que la lanzó, de ${t.name ? `${t.name} (${t.phone ?? ""})` : (t.phone ?? "un cliente")}: «${String(t.text ?? "").slice(0, 500)}»`
          })()}
        </p>
      ) : null}
      {(run.trigger as { type?: string } | null)?.type === "telegram_chat" ? (
        <p className="border-l-2 border-rule pl-3 text-sm text-graphite">
          {(run.trigger as { voice?: boolean }).voice ? "Nota de voz que enviaste por Telegram" : "Lo que pediste por Telegram"}: «
          {String((run.trigger as { text?: string }).text ?? "").slice(0, 500)}»
        </p>
      ) : null}
      {["email_message", "inbox_prepare"].includes((run.trigger as { type?: string } | null)?.type ?? "") ? (
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

// Texto de un aviso enviado al propio usuario (notify_me).
function noticeText(detail: unknown): string | null {
  const n = detail && typeof detail === "object" ? (detail as { notice?: unknown }).notice : null
  return typeof n === "string" && n ? n : null
}

// Integraciones (proveedor en la base) → ficha de ayuda.
const PROVIDER_GUIDE: Record<string, string> = {
  google: "drive",
  calendar: "calendar",
  contacts: "contacts",
  hubspot: "hubspot",
  buffer: "buffer",
  whatsapp: "whatsapp",
  telegram: "telegram",
  imap: "imap",
  tokko: "tokko",
  xubio: "xubio",
}

// «Por qué falló»: diagnóstico sin IA (src/lib/run-diagnosis.ts) con lo que
// está conectado ahora, qué hacer, la tarjeta que abrir, volver a ejecutar y
// preguntar al ayudante.
async function Diagnosis({ workspaceId, flowId, error }: { workspaceId: string; flowId: string | null; error: string | null }) {
  const supabase = await createClient()
  const [{ data: ais }, { data: integrations }, { data: flow }] = await Promise.all([
    supabase.from("ai_connections").select("provider, status").eq("workspace_id", workspaceId),
    supabase.from("integrations").select("provider, status").eq("workspace_id", workspaceId),
    flowId ? supabase.from("flows").select("settings").eq("id", flowId).eq("workspace_id", workspaceId).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const live: LiveStatus = {}
  for (const a of ais ?? []) if (a.status === "active") live[a.provider] = true
  for (const i of integrations ?? []) if (i.status === "active" && PROVIDER_GUIDE[i.provider]) live[PROVIDER_GUIDE[i.provider]] = true
  const d = diagnoseRun(error, live)
  const guide = d.guide ? HELP_GUIDES.find((g) => g.id === d.guide) : undefined
  const settings = (flow?.settings ?? {}) as { file_ids?: unknown }
  const fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter((id): id is string => typeof id === "string") : []

  return (
    <PanelCard className="run-detail-card is-danger" bodyPadding="none" headerDensity="compact" title="Por qué falló">
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="text-ink">{d.cause}</p>
        {error ? <p className="border-l-2 border-rule pl-3 text-sm text-graphite">{error}</p> : null}
        <p className="text-sm text-ink">
          <strong>Qué hacer:</strong> {d.fix}
        </p>
        {d.kind === "trial_ended" && !d.retry ? (
          <a
            href={SOLO_UPGRADE_URL}
            className="self-start text-sm font-semibold text-link underline underline-offset-4"
            {...(SOLO_UPGRADE_IS_EXTERNAL ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            Pasar al plan Solo →
          </a>
        ) : null}
        {guide ? (
          <Link
            href={`/w/${workspaceId}/integraciones?abrir=${guide.id}#${guide.section}`}
            className="self-start text-sm font-semibold text-link underline underline-offset-4"
          >
            Abrir la tarjeta de {guide.title} →
          </Link>
        ) : null}
        <DiagnosisActions workspaceId={workspaceId} flowId={flowId} fileIds={fileIds} retry={d.retry} />
        {d.editable && flowId ? (
          <p className="text-xs text-graphite">El ayudante puede proponerte cómo reescribir los pasos; los cambios se guardan solo si los aplicas.</p>
        ) : null}
      </div>
    </PanelCard>
  )
}

// IA de la ejecución (router, fase 8): modelos, llamadas, coste estimado,
// presupuesto, motivo y ahorro frente a usar siempre el modelo más capaz del
// mismo proveedor (con los mismos tokens).
function RunAi({
  run,
  calls,
  models,
}: {
  run: { model: string | null; routing: unknown; routing_mode: string | null; cost_usd: number; budget_usd: number | null; started_at: string; finished_at: string | null }
  calls: { model: string; input_tokens: number; output_tokens: number; cached_tokens: number; cache_write_tokens: number; cost_usd: number; latency_ms: number | null }[]
  models: Record<string, unknown>[]
}) {
  const routing = (run.routing && typeof run.routing === "object" ? run.routing : {}) as {
    reason?: unknown
    trial?: unknown
    switches?: { from?: string; to?: string; code?: string }[]
  }
  const trialFunded = routing.trial === true
  if (!run.model && !calls.length) return null
  const catalog = models.map((m) => toModelInfo(m)).filter((m): m is ModelInfo => m !== null)
  const cat = catalog.length ? catalog : FALLBACK_CATALOG
  const used = [...new Set(calls.map((c) => c.model))]
  const cost = Number(run.cost_usd) || calls.reduce((a, c) => a + Number(c.cost_usd), 0)
  const main = cat.find((m) => m.model === (calls[0]?.model ?? run.model))
  const premium = main
    ? cat.filter((m) => m.provider === main.provider && m.tier === "premium").sort((a, b) => a.price_in - b.price_in)[0]
    : undefined
  const reference = premium && calls.length
    ? calls.reduce(
      (a, c) => a + costUsd(premium, { input: c.input_tokens, output: c.output_tokens, cached: c.cached_tokens, cacheWrite: c.cache_write_tokens }),
      0,
    )
    : 0
  const saving = reference > 0 && cost > 0 && !used.every((m) => m === premium?.model) ? Math.round((1 - cost / reference) * 100) : null
  const end = run.finished_at ? new Date(run.finished_at).getTime() : null
  const seconds = end ? Math.max(0, Math.round((end - new Date(run.started_at).getTime()) / 1000)) : null
  const modeLabel = run.routing_mode === "fixed" ? "modelo fijo" : isMode(run.routing_mode) ? MODE_LABEL[run.routing_mode] : null
  const reason = typeof routing.reason === "string" ? routing.reason : null
  const switches = Array.isArray(routing.switches) ? routing.switches : []

  return (
    <PanelCard className="run-detail-card" bodyPadding="none" headerDensity="compact" title="IA de esta ejecución">
      <div className="flex flex-col gap-2 px-5 py-4 text-sm text-graphite">
        <p>
          {used.length ? (
            <>
              {used.length === 1 ? "Modelo" : "Modelos"}: <span className="font-medium text-ink">{used.map((m) => modelLabel(m)).join(", ")}</span>
            </>
          ) : (
            <>
              Modelo: <span className="font-medium text-ink">{modelLabel(run.model)}</span>
            </>
          )}
          {modeLabel ? ` · ${modeLabel}` : ""} · {calls.length} {calls.length === 1 ? "llamada" : "llamadas"} · {trialFunded ? "coste asumido por MarchaSolo" : "coste estimado"}{" "}
          <span className="font-medium text-ink">{formatUsd(cost)}</span>
          {run.budget_usd ? trialFunded ? ` de ${formatUsd(Number(run.budget_usd))} de presupuesto gratuito` : ` de ${formatUsd(Number(run.budget_usd))} de presupuesto` : ""}
          {seconds !== null ? ` · ${seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`}` : ""}
        </p>
        {reason ? <p>{reason}</p> : null}
        {switches.map((x, i) => (
          <p key={i} className="border-l-2 border-coral pl-3">
            Se pasó de {modelLabel(x.from)} a {modelLabel(x.to)}
            {x.code === "limit" ? " porque la cuenta se quedó sin saldo o llegó a su límite" : x.code === "invalid_key" ? " porque la clave fue rechazada" : x.code === "disconnected" ? " porque su IA ya no está conectada" : " porque el proveedor no respondía bien"}.
          </p>
        ))}
        {saving !== null && saving > 0 && premium ? (
          <p>
            Un {saving} % menos que con {premium.label} para el mismo trabajo ({formatUsd(reference)}).
          </p>
        ) : null}
        <p className="text-xs">{trialFunded ? "MarchaSolo asume este coste. No se carga a tu cuenta de IA." : "Estimación con los tokens que informa el proveedor y sus precios oficiales; la factura que vale es la de tu cuenta."}</p>
      </div>
    </PanelCard>
  )
}
