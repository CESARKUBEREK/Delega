import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PlanView } from "@/components/plan-view"
import { asPlan, FLOW_STATUS_LABEL, RUN_STATUS_LABEL } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { deleteFlow } from "../../ai-actions"
import { formatDateTime } from "../../format"
import { ActivationPanel, RunPanel } from "./run-panel"

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
    .select("id, name, status, definition, settings, created_by, created_at, updated_at, source_message_id")
    .eq("id", flowId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!flow) notFound()

  const [{ data: rawFiles }, { data: ai }, { data: runs }, { data: tg }] = await Promise.all([
    supabase.from("integration_files").select("id, name, mime_type").eq("workspace_id", workspaceId).order("name"),
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId).eq("provider", "openai").maybeSingle(),
    supabase
      .from("flow_runs")
      .select("id, status, started_at")
      .eq("workspace_id", workspaceId)
      .eq("flow_id", flow.id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase.from("integrations").select("status").eq("workspace_id", workspaceId).eq("provider", "telegram").maybeSingle(),
  ])
  const files = (rawFiles ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.mime_type === "application/vnd.google-apps.document" ? "documento" : "planilla",
  }))

  const plan = asPlan(flow.definition)
  const canDelete = isAdmin || flow.created_by === user.id
  const autoTrigger = plan?.trigger.type === "telegram_message"
  const savedFileIds = Array.isArray((flow.settings as { file_ids?: unknown } | null)?.file_ids)
    ? ((flow.settings as { file_ids: unknown[] }).file_ids.filter((x) => typeof x === "string") as string[])
    : []
  const base = `/w/${workspaceId}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm">
          <Link href={`${base}/automatizaciones`} className="text-stroke underline underline-offset-4">
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
          <h2 className="border-b border-ink px-5 py-3 font-semibold">Ejecución automática</h2>
          <div className="px-5 py-4">
            <ActivationPanel
              workspaceId={workspaceId}
              flowId={flow.id}
              status={flow.status}
              files={files}
              savedFileIds={savedFileIds}
              telegramReady={tg?.status === "active"}
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
            aiReady={ai?.status === "active"}
            needsFiles={Boolean(plan?.connections.some((c) => c.kind === "spreadsheet" || c.kind === "documents"))}
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
