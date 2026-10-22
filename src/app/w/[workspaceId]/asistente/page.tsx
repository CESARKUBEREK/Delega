import Link from "next/link"
import { Suspense } from "react"
import { asPlan } from "@/lib/plan"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { Chat, type ChatMessage } from "./chat"

export const metadata = { title: "Asistente" }
// La respuesta del modelo puede tardar: la acción espera a la Edge Function.
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

  const [{ data: connection }, { data: conversations }, { data: rows }] = await Promise.all([
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

        <Chat key={conversationId ?? "new"} workspaceId={workspaceId} conversationId={conversationId} initialMessages={messages} />
      </section>

      <aside className="h-fit border border-ink bg-sheet">
        <h2 className="border-b border-ink px-4 py-2.5 text-sm font-semibold">Conversaciones</h2>
        {conversations && conversations.length > 0 ? (
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
        )}
      </aside>
    </div>
  )
}
