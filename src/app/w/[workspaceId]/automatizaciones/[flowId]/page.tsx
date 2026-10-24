import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PlanView } from "@/components/plan-view"
import { asPlan, AUTO_TRIGGERS, fileKindLabel, FLOW_STATUS_LABEL, modelLabel, RUN_STATUS_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { deleteFlow } from "../../ai-actions"
import { formatDateTime, formatLong } from "../../format"
import { ActivationPanel, type EmailFilterInput, FlowModelForm, RunPanel, type ScheduleInput } from "./run-panel"

export const metadata = { title: "Automatización" }

export default function FlowPage({ params }: PageProps<"/w/[workspaceId]/automatizaciones/[flowId]">) {
  return (
    <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
      <Flow params={params} />
    </Suspense>
  )
}

async function Flow({ params }: { params: PageProps<"/w/[workspaceId]/automatizaciones/[flowId]">["params"] }) {
  const { workspaceId, flowId } = await params
  if (!UUID_RE.test(flowId)) notFound()
  const { user, isAdmin } = await getWorkspace(workspaceId, `/w/${workspaceId}/automatizaciones/${flowId}`)
  const supabase = await createClient()

  const { data: flow } = await supabase
    .from("flows")
    .select("id, name, status, definition, settings, created_by, created_at, updated_at, source_message_id, next_run_at")
    .eq("id", flowId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!flow) notFound()

  const [{ data: rawFiles }, { data: ai }, { data: runs }, { data: channels }] = await Promise.all([
    supabase.from("integration_files").select("id, name, mime_type").eq("workspace_id", workspaceId).order("name"),
    supabase.from("ai_connections").select("provider, model, status, is_default").eq("workspace_id", workspaceId),
    supabase
      .from("flow_runs")
      .select("id, status, started_at")
      .eq("workspace_id", workspaceId)
      .eq("flow_id", flow.id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase.from("integrations").select("provider, status, config").eq("workspace_id", workspaceId).in("provider", ["telegram", "imap", "calendar"]),
  ])
  const files = (rawFiles ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    kind: fileKindLabel(f.mime_type).toLowerCase(),
  }))

  const plan = asPlan(flow.definition)
  const canDelete = isAdmin || flow.created_by === user.id
  const trigger = plan && AUTO_TRIGGERS.has(plan.trigger.type) ? (plan.trigger.type as "telegram_message" | "email_message" | "schedule") : null
  const autoTrigger = trigger !== null
  // La bandeja solo la ven los administradores: los flujos que arrancan con un
  // correo o un mensaje solo se lanzan si los creó un owner o admin.
  const { data: creator } = flow.created_by
    ? await supabase.from("memberships").select("role, status").eq("workspace_id", workspaceId).eq("user_id", flow.created_by).maybeSingle()
    : { data: null }
  const creatorIsAdmin = creator?.status === "active" && (creator.role === "owner" || creator.role === "admin")
  const channelReady = (channels ?? []).some(
    (c) => c.status === "active" && c.provider === (trigger === "email_message" ? "imap" : "telegram"),
  )
  const emailFilter = readEmailFilter((flow.settings as { email_filter?: unknown } | null)?.email_filter)
  const { data: ws } = await supabase.from("workspaces").select("timezone").eq("id", workspaceId).maybeSingle()
  const timezone = String(
    ws?.timezone || ((channels ?? []).find((c) => c.provider === "calendar")?.config as { timezone?: string } | null)?.timezone || "Europe/Madrid",
  )
  const schedule = readSchedule((flow.settings as { schedule?: unknown } | null)?.schedule)
  const savedFileIds = Array.isArray((flow.settings as { file_ids?: unknown } | null)?.file_ids)
    ? ((flow.settings as { file_ids: unknown[] }).file_ids.filter((x) => typeof x === "string") as string[])
    : []
  const base = `/w/${workspaceId}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          <Link href={`${base}/automatizaciones`} className="text-link underline underline-offset-4">
            Automatizaciones
          </Link>
        </p>
        <h1 className="rotulo mt-2 text-2xl">{flow.name}</h1>
        <p className="mt-1 text-sm text-graphite">
          {FLOW_STATUS_LABEL[flow.status] ?? flow.status}, guardado el {formatDateTime(flow.created_at)}
        </p>
      </div>

      {plan ? <PlanView plan={plan} /> : <p className="text-graphite">Este flujo no tiene un plan legible.</p>}

      {autoTrigger ? (
        <section className="border border-ink bg-sheet">
          <h2 className="border-b border-ink px-5 py-3 font-semibold">{trigger === "schedule" ? "Programación" : "Ejecución automática"}</h2>
          <div className="px-5 py-4">
            <ActivationPanel
              workspaceId={workspaceId}
              flowId={flow.id}
              status={flow.status}
              trigger={trigger!}
              files={files}
              savedFileIds={savedFileIds}
              channelReady={channelReady}
              inboxBlocked={(trigger === "email_message" || trigger === "telegram_message") && !creatorIsAdmin}
              emailFilter={emailFilter}
              schedule={schedule}
              nextRun={flow.next_run_at ? formatLong(flow.next_run_at, timezone) : null}
              canEdit={canDelete}
            />
          </div>
        </section>
      ) : null}

      {(ai ?? []).length > 0 ? (
        <section className="border border-ink bg-sheet">
          <h2 className="border-b border-ink px-5 py-3 font-semibold">IA de esta automatización</h2>
          <div className="px-5 py-4">
            <FlowModelForm
              workspaceId={workspaceId}
              flowId={flow.id}
              model={typeof (flow.settings as { model?: unknown } | null)?.model === "string" ? ((flow.settings as { model: string }).model) : ""}
              providers={(ai ?? []).filter((c) => c.status === "active").map((c) => c.provider)}
              defaultLabel={(() => {
                const d = (ai ?? []).find((c) => c.is_default) ?? (ai ?? [])[0]
                return d ? modelLabel(d.model) : ""
              })()}
              canEdit={canDelete}
            />
          </div>
        </section>
      ) : null}

      <section className="border border-ink bg-sheet">
        <h2 className="border-b border-ink px-5 py-3 font-semibold">{autoTrigger ? "Probar a mano" : "Ejecutar"}</h2>
        <div className="px-5 py-4">
          <RunPanel
            workspaceId={workspaceId}
            flowId={flow.id}
            files={files}
            aiReady={(ai ?? []).some((c) => c.status === "active")}
            needsFiles={Boolean(plan?.connections.some((c) => c.kind === "spreadsheet" || c.kind === "documents" || c.kind === "drive"))}
            isAdmin={isAdmin}
          />
        </div>
      </section>

      {runs && runs.length > 0 ? (
        <section className="border border-ink bg-sheet">
          <h2 className="border-b border-ink px-5 py-3 font-semibold">Ejecuciones de esta automatización</h2>
          <ul className="divide-y divide-rule">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/ejecuciones/${r.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-paper">
                  <span className="text-ink">{formatDateTime(r.started_at)}</span>
                  <span className="text-sm text-graphite">{RUN_STATUS_LABEL[r.status] ?? r.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-graphite">
        Para cambiar el plan, pídeselo al asistente
        {flow.source_message_id ? " en la conversación original" : ""} y guarda la nueva versión.
      </p>

      {canDelete ? (
        <form action={deleteFlow} className="border-t border-rule pt-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="flowId" value={flow.id} />
          <button type="submit" className="text-sm text-alert underline underline-offset-4">
            Borrar esta automatización
          </button>
        </form>
      ) : null}
    </div>
  )
}

function readEmailFilter(v: unknown): EmailFilterInput {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  const list = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : [])
  return { from: list(o.from), subject: list(o.subject), words: list(o.words), skip_automatic: o.skip_automatic !== false }
}

function readSchedule(v: unknown): ScheduleInput {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  const frequency = ["daily", "weekdays", "weekly", "monthly"].includes(String(o.frequency)) ? (o.frequency as ScheduleInput["frequency"]) : "weekdays"
  const time = typeof o.time === "string" && /^\d{2}:\d{2}$/.test(o.time) ? o.time : "08:00"
  const weekday = typeof o.weekday === "number" ? o.weekday : 1
  const day = typeof o.day_of_month === "number" ? o.day_of_month : 1
  return { frequency, time, weekday, day_of_month: day }
}
