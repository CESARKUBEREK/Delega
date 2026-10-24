import Link from "next/link"
import { Suspense } from "react"
import { asPending } from "@/lib/pending"
import { asPlan, fileKindLabel } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { Chat, type ChatMessage, type ChatRun } from "./chat"

export const metadata = { title: "Asistente" }
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
  const { c } = await searchParams
  const requested = typeof c === "string" && UUID_RE.test(c) ? c : null
  const base = `/w/${workspaceId}`

  const { isAdmin } = await getWorkspace(workspaceId, `${base}/asistente`)
  const supabase = await createClient()

  const [{ data: connection }, { data: conversations }, { data: rows }, { data: rawFiles }] = await Promise.all([
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId).eq("provider", "openai").maybeSingle(),
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
    <div className="grid gap-6 xl:grid-cols-[1fr_15rem]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="rotulo text-2xl">Asistente</h1>
          {conversationId ? (
            <Link href={`${base}/asistente`} className="text-sm text-link underline underline-offset-4">
              Nueva conversación
            </Link>
          ) : null}
        </div>

        {/* En el móvil y la tableta, las conversaciones anteriores van plegadas aquí. */}
        <details className="mb-4 border border-ink bg-sheet xl:hidden">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">Conversaciones anteriores</summary>
          <div className="border-t border-rule">{list}</div>
        </details>

        {connection?.status !== "active" ? (
          <div className="mb-4 border-l-2 border-alert bg-alert-bg px-4 py-3 text-sm text-alert" role="status">
            {connection ? "La clave de OpenAI de este espacio dejó de funcionar. " : "Este espacio aún no tiene una clave de OpenAI. "}
            {isAdmin ? (
              <Link href={`${base}/integraciones`} className="underline underline-offset-4">
                Conéctala en Integraciones
              </Link>
            ) : (
              "Pide a un administrador que la conecte."
            )}
          </div>
        ) : null}

        <Chat
          key={conversationId ?? "new"}
          workspaceId={workspaceId}
          conversationId={conversationId}
          initialMessages={messages}
          runs={runs}
          files={files}
          aiReady={connection?.status === "active"}
        />
      </section>

      <aside className="hidden h-fit border border-ink bg-sheet xl:block">
        <h2 className="border-b border-ink px-4 py-2.5 text-sm font-semibold">Conversaciones</h2>
        {list}
      </aside>
    </div>
  )
}
