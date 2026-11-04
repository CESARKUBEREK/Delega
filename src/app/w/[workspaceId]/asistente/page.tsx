import Link from "next/link"
import { Suspense } from "react"
import { asPending } from "@/lib/pending"
import { asPlan, fileKindLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { InfoBanner, PageHeader, PanelCard } from "@/components/ui"
import { Chat, type ChatMessage, type ChatRun } from "./chat"

export const metadata = { title: "Chat" }
// La respuesta del modelo y cada tramo de una ejecución pueden tardar: las
// acciones esperan a la Edge Function.
export const maxDuration = 120

export default function AssistantPage({ params, searchParams }: PageProps<"/w/[workspaceId]/asistente">) {
  return (
    <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
      <Assistant params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Assistant({
  params,
  searchParams,
}: Pick<PageProps<"/w/[workspaceId]/asistente">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const { c, q } = await searchParams
  const requested = typeof c === "string" && UUID_RE.test(c) ? c : null
  const initialDraft = typeof q === "string" ? q.trim().slice(0, 2000) : ""
  const base = `/w/${workspaceId}`

  const { isAdmin } = await getWorkspace(workspaceId, `${base}/asistente`)
  const supabase = await createClient()

  const [{ data: connections }, { data: conversations }, { data: rows }, { data: rawFiles }] = await Promise.all([
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId),
    supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(30),
    requested
      ? supabase
          .from("messages")
          .select("id, role, content, plan")
          .eq("workspace_id", workspaceId)
          .eq("conversation_id", requested)
          .order("created_at")
          .limit(200)
      : Promise.resolve({ data: [] }),
    supabase.from("integration_files").select("id, name, mime_type").eq("workspace_id", workspaceId).order("name").limit(100),
  ])

  const aiActive = (connections ?? []).some((c) => c.status === "active")
  // Solo se abre la conversación si la RLS la devuelve en la lista.
  const conversationId = requested && conversations?.some((x) => x.id === requested) ? requested : null
  const messages: ChatMessage[] = conversationId
    ? (rows ?? []).map((m) => ({
        key: `db-${m.id}`,
        id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
        plan: asPlan(m.plan),
      }))
    : []

  // Última ejecución lanzada desde cada mensaje («Ejecutar ahora»).
  const planIds = messages.filter((m) => m.plan && m.id !== null).map((m) => m.id as number)
  const runs: Record<number, ChatRun> = {}
  if (planIds.length) {
    const { data: runRows } = await supabase
      .from("flow_runs")
      .select("id, status, pending_action, summary, error, source_message_id, started_at")
      .eq("workspace_id", workspaceId)
      .in("source_message_id", planIds)
      .order("started_at")
    const active = (runRows ?? []).filter((r) => r.status === "running").map((r) => r.id)
    const { data: events } = active.length
      ? await supabase.from("run_events").select("run_id, title").in("run_id", active).eq("workspace_id", workspaceId).order("id", { ascending: false }).limit(50)
      : { data: [] }
    for (const r of runRows ?? []) {
      if (r.source_message_id === null) continue
      runs[r.source_message_id] = {
        id: r.id,
        status: r.status,
        pending: r.status === "awaiting_approval" ? asPending(r.pending_action) : null,
        summary: r.summary,
        error: r.error,
        lastEvent: events?.find((e) => e.run_id === r.id)?.title ?? null,
      }
    }
  }
  const list =
    conversations && conversations.length > 0 ? (
      <ul className="max-h-[28rem] divide-y divide-rule overflow-y-auto">
        {conversations.map((x) => (
          <li key={x.id}>
            <Link
              href={`${base}/asistente?c=${x.id}`}
              aria-current={x.id === conversationId ? "page" : undefined}
              className={`block px-4 py-2.5 hover:bg-paper ${x.id === conversationId ? "bg-paper" : ""}`}
            >
              <span className="block truncate text-sm text-ink">{x.title}</span>
              <span className="text-xs text-graphite">{formatDateTime(x.updated_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    ) : (
      <p className="px-4 py-3 text-sm text-graphite">Aún no hay conversaciones.</p>
    )

  const files = (rawFiles ?? []).map((f) => ({ id: f.id, name: f.name, kind: fileKindLabel(f.mime_type).toLowerCase() }))

  return (
    <div className="automation-page flex flex-col">
      <PageHeader
        eyebrow="TU ASISTENTE"
        title="Chat"
        description="Cuéntale qué necesitas. MarchaSolo prepara el trabajo y tú decides qué se ejecuta o se envía."
        actions={conversationId ? (
          <Link href={`${base}/asistente`} className="automation-text-link">
            Nueva conversación <span aria-hidden="true">→</span>
          </Link>
        ) : undefined}
      />

      <div className="assistant-page">
        <section className="min-w-0">
          {/* En el móvil y la tableta, las conversaciones anteriores van plegadas aquí. */}
          <PanelCard className="assistant-history-mobile mb-4 xl:hidden" title="Conversaciones anteriores">
            {list}
          </PanelCard>

          {!aiActive ? (
            <InfoBanner className="mb-4" tone="danger" role="status">
              {connections?.length ? "La clave de la IA de este espacio dejó de funcionar. " : "Este espacio aún no tiene una IA conectada. "}
              {isAdmin ? (
                <Link href={`${base}/integraciones`} className="underline underline-offset-4">
                  Conéctala en Integraciones
                </Link>
              ) : (
                "Pide a un administrador que la conecte."
              )}
            </InfoBanner>
          ) : null}

          <Chat
            key={conversationId ?? "new"}
            workspaceId={workspaceId}
            conversationId={conversationId}
            initialMessages={messages}
            runs={runs}
            files={files}
            aiReady={aiActive}
            initialDraft={initialDraft}
          />
        </section>

        <PanelCard className="assistant-history hidden h-fit xl:block" title="Conversaciones">
          {list}
        </PanelCard>
      </div>
    </div>
  )
}
