import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { RUN_STATUS_LABEL } from "@/lib/plan"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime, formatNumber } from "../../format"
import { ApprovalCard, type Cell, RunControls, type Pending } from "./run-live"

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

function asPending(value: Json | null): Pending | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const t = (x: unknown) => (typeof x === "string" ? x : "")
  switch (v.tool) {
    case "append_rows":
    case "update_range":
      if (!Array.isArray(v.values)) return null
      return {
        tool: v.tool,
        fileName: t(v.file_name),
        range: t(v.range),
        values: v.values as Cell[][],
        before: Array.isArray(v.before) ? (v.before as Cell[][]) : null,
      }
    case "append_to_document":
      return { tool: "append_to_document", fileName: t(v.file_name), text: t(v.text) }
    case "create_document":
      return { tool: "create_document", title: t(v.title), text: t(v.text) }
    case "send_email":
      return { tool: "send_email", to: t(v.to_label), address: t(v.address), subject: t(v.subject), text: t(v.body) }
    case "send_telegram":
      return { tool: "send_telegram", to: t(v.to_label), text: t(v.text) }
    case "save_file": {
      const ext = v.format === "documento" ? "documento de Google" : v.format === "csv" ? "CSV" : "texto"
      return {
        tool: "generic",
        description: `Guardar «${t(v.name)}» (${ext}) en la carpeta «${t(v.folder_name)}».`,
        verb: "Aprobar y guardar",
        fields: [],
        text: t(v.text),
        textCaption: "Contenido",
      }
    }
    case "create_event": {
      const ev = obj(v.event)
      const attendees = Array.isArray(v.attendees) ? v.attendees.map((a) => `${t(obj(a).label)} <${t(obj(a).email)}>`).join(", ") : ""
      return {
        tool: "generic",
        description: attendees
          ? "Crear este evento en tu calendario y enviar la invitación a los invitados."
          : "Crear este evento en tu calendario.",
        verb: "Aprobar y crear",
        fields: [
          { label: "Título", value: t(ev.title) },
          { label: ev.all_day ? "Día" : "Inicio", value: when(t(ev.start)) },
          ...(ev.all_day ? [] : [{ label: "Fin", value: when(t(ev.end)) }]),
          ...(t(ev.location) ? [{ label: "Lugar", value: t(ev.location) }] : []),
          ...(attendees ? [{ label: "Invitados", value: attendees }] : []),
        ],
        text: t(ev.description) || null,
        textCaption: "Descripción",
      }
    }
    case "update_event": {
      const c = obj(v.changes)
      const fields = [
        ["title", "Título"],
        ["start", "Inicio"],
        ["end", "Fin"],
        ["location", "Lugar"],
        ["description", "Descripción"],
      ]
        .filter(([k]) => typeof c[k] === "string" && c[k])
        .map(([k, label]) => ({ label, value: k === "start" || k === "end" ? when(t(c[k])) : t(c[k]) }))
      return {
        tool: "generic",
        description: `Cambiar el evento «${t(v.title_before)}» (${t(v.when_before)}). Se avisará a sus invitados.`,
        verb: "Aprobar y cambiar",
        fields,
        text: null,
        textCaption: "",
      }
    }
    case "crm_create":
    case "crm_update": {
      const props = obj(v.properties)
      const before = obj(v.before)
      const label = CRM_LABEL[t(v.object)] ?? "registro"
      return {
        tool: "generic",
        description: v.tool === "crm_create" ? `Crear un ${label} en HubSpot.` : `Actualizar el ${label} «${t(v.label)}» en HubSpot.`,
        verb: v.tool === "crm_create" ? "Aprobar y crear" : "Aprobar y actualizar",
        fields: Object.entries(props).map(([k, val]) =>
          v.tool === "crm_update" ? { label: k, value: t(val), before: typeof before[k] === "string" ? (before[k] as string) : null } : { label: k, value: t(val) }
        ),
        text: null,
        textCaption: "",
      }
    }
    case "crm_note":
      return {
        tool: "generic",
        description: `Añadir esta nota al ${CRM_LABEL[t(v.object)] ?? "registro"} «${t(v.label)}» en HubSpot.`,
        verb: "Aprobar y añadir",
        fields: [],
        text: t(v.text),
        textCaption: "Nota",
      }
    case "crm_task":
      return {
        tool: "generic",
        description: `Crear una tarea para el ${CRM_LABEL[t(v.object)] ?? "registro"} «${t(v.label)}» en HubSpot.`,
        verb: "Aprobar y crear",
        fields: [
          { label: "Asunto", value: t(v.subject) },
          { label: "Vence", value: t(v.due_date) ? when(t(v.due_date)) : "mañana" },
        ],
        text: t(v.text) || null,
        textCaption: "Detalle",
      }
    default:
      return null
  }
}

const CRM_LABEL: Record<string, string> = { contacts: "contacto", companies: "empresa", deals: "negocio" }

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {}
}

// "2026-11-03T10:00" → "3 nov 2026, 10:00"; "2026-11-03" → "3 nov 2026".
function when(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return value
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  const date = `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`
  return m[4] ? `${date}, ${m[4]}:${m[5]}` : date
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          {run.flow_id ? (
            <Link href={`${base}/automatizaciones/${run.flow_id}`} className="text-link underline underline-offset-4">
              {run.flow_name}
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
    </div>
  )
}
