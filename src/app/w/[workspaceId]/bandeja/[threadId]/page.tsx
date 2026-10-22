import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime } from "../../format"
import { ClassifyButton } from "../classify-button"
import { ReplyComposer } from "./reply-composer"
import { ThreadForm } from "./thread-form"

export const metadata = { title: "Conversación" }
export const maxDuration = 120

const DEFAULT_CATEGORIES = ["Cliente", "Proveedor", "Obra o proyecto", "Administración", "Personal", "Publicidad", "Otros"]
const CHANNEL_LABEL: Record<string, string> = { email: "Correo", telegram: "Telegram" }

export default function ThreadPage({ params }: PageProps<"/w/[workspaceId]/bandeja/[threadId]">) {
  return (
    <Suspense fallback={<div className="h-96 border border-rule bg-sheet" aria-busy="true" />}>
      <Thread params={params} />
    </Suspense>
  )
}

async function Thread({ params }: { params: PageProps<"/w/[workspaceId]/bandeja/[threadId]">["params"] }) {
  const { workspaceId, threadId } = await params
  if (!UUID_RE.test(threadId)) notFound()
  const base = `/w/${workspaceId}/bandeja`
  const { isAdmin } = await getWorkspace(workspaceId, `${base}/${threadId}`)
  if (!isAdmin) notFound()

  const supabase = await createClient()
  const [{ data: thread }, { data: messages }, { data: integration }] = await Promise.all([
    supabase
      .from("inbox_threads")
      .select("id, channel, subject, contact_name, contact_address, category, client, project, urgency, needs_reply, summary, archived, manually_edited, classified_at, message_count")
      .eq("id", threadId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("inbox_messages")
      .select("id, direction, sender_name, sender_address, recipients, subject, body, sent_at, run_id")
      .eq("thread_id", threadId)
      .eq("workspace_id", workspaceId)
      .order("sent_at", { ascending: false })
      .limit(200),
    supabase.from("integrations").select("provider, status, config").eq("workspace_id", workspaceId).in("provider", ["gmail", "telegram"]),
  ])
  if (!thread) notFound()
  const integrations = integration ?? []
  const settings = (integrations.find((i) => i.provider === "gmail") ?? integrations[0])?.config as { categories?: string[] } | undefined
  const categories = settings?.categories?.length ? settings.categories : DEFAULT_CATEGORIES
  const channelIntegration = integrations.find((i) => i.provider === (thread.channel === "email" ? "gmail" : "telegram"))
  const canReply = channelIntegration?.status === "active" && (thread.channel === "telegram" || Boolean(thread.contact_address))
  const who = thread.contact_name ?? thread.contact_address ?? "Sin nombre"

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <section className="min-w-0">
        <p className="text-sm">
          <Link href={base} className="text-link underline underline-offset-4">
            Bandeja
          </Link>
        </p>
        <h1 className="rotulo mt-2 text-2xl">{thread.subject || who}</h1>
        <p className="mt-1 text-sm text-graphite">
          {CHANNEL_LABEL[thread.channel]} · {who}
          {thread.contact_address && thread.contact_address !== who ? ` (${thread.contact_address})` : ""} · {thread.message_count} mensajes
        </p>
        {thread.summary ? <p className="mt-4 border-l-2 border-stroke pl-3 text-ink">{thread.summary}</p> : null}

        <div className="mt-6">
          {canReply ? (
            <ReplyComposer workspaceId={workspaceId} threadId={thread.id} channel={thread.channel} to={who} />
          ) : (
            <p className="text-sm text-graphite">
              {channelIntegration
                ? "No se puede responder: la conexión no está activa o falta la dirección del contacto."
                : `Conecta ${thread.channel === "email" ? "Gmail" : "el bot de Telegram"} para responder desde aquí.`}
            </p>
          )}
        </div>

        <ol className="mt-6 flex flex-col gap-3" aria-label="Mensajes, del más reciente al más antiguo">
          {(messages ?? []).map((m) => (
            <li key={m.id} className={m.direction === "out" ? "flex justify-end" : ""}>
              <div className={`max-w-[85%] border px-3 py-2 ${m.direction === "out" ? "border-rule bg-paper" : "border-ink bg-sheet"}`}>
                <p className="mb-1 text-xs text-graphite">
                  {m.direction === "out" ? `Tú${m.recipients ? ` → ${m.recipients}` : ""}` : (m.sender_name ?? m.sender_address ?? "Contacto")}
                </p>
                <p className="text-sm break-words whitespace-pre-wrap text-ink">{m.body || "(sin texto)"}</p>
                <p className="mt-1 text-xs text-graphite">
                  {formatDateTime(m.sent_at)}
                  {m.run_id && m.direction === "out" ? " · enviado por una automatización" : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className="h-fit border border-ink bg-sheet p-5">
        <h2 className="rotulo text-lg">Clasificación</h2>
        <p className="mt-1 mb-4 text-xs text-graphite">
          {thread.manually_edited
            ? "Corregida a mano: la IA solo actualiza el resumen."
            : thread.classified_at
              ? `Propuesta por la IA el ${formatDateTime(thread.classified_at)}.`
              : "Aún sin clasificar."}
        </p>
        <ThreadForm
          workspaceId={workspaceId}
          thread={{
            id: thread.id,
            category: thread.category,
            client: thread.client,
            project: thread.project,
            urgency: thread.urgency,
            needsReply: Boolean(thread.needs_reply),
            archived: thread.archived,
          }}
          categories={categories}
        />
        <div className="mt-4 border-t border-rule pt-4">
          <ClassifyButton workspaceId={workspaceId} pending={1} threadId={thread.id} />
        </div>
      </aside>
    </div>
  )
}
