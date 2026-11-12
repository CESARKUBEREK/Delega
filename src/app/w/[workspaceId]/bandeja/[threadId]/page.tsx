import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace, UUID_RE } from "@/lib/workspace"
import { formatDateTime } from "../../format"
import { DEFAULT_CATEGORIES } from "@/lib/inbox"
import { CategoryChip } from "../category-chip"
import { ClassifyButton } from "../classify-button"
import { ReplyComposer } from "./reply-composer"
import { SenderProfileCard } from "./sender-profile"
import { ThreadForm } from "./thread-form"
import { PageHeader, PanelCard } from "@/components/ui"

export const metadata = { title: "Conversación" }
export const maxDuration = 120

const CHANNEL_LABEL: Record<string, string> = { email: "Correo", telegram: "Telegram", whatsapp: "WhatsApp", phone: "Teléfono", web: "Web (voz)" }

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
      .select("id, channel, external_id, subject, contact_name, contact_address, category, category_source, client, project, urgency, needs_reply, summary, archived, manually_edited, classified_at, message_count")
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
    supabase.from("integrations").select("provider, status, config").eq("workspace_id", workspaceId).in("provider", ["imap", "telegram", "whatsapp"]),
  ])
  if (!thread) notFound()
  // Contexto local: solo se vincula un contacto si el email coincide exactamente.
  // Las conversaciones con el mismo identificador se muestran como coincidencias,
  // nunca como identidad consolidada o asociación confirmada.
  const normalizedAddress = thread.contact_address?.trim().toLowerCase() ?? ""
  const [{ data: contactRows }, { data: recentRows }] = await Promise.all([
    normalizedAddress.includes("@")
      ? supabase
          .from("contacts")
          .select("id, name, email")
          .eq("workspace_id", workspaceId)
          .eq("email", normalizedAddress)
          .limit(2)
      : Promise.resolve({ data: [] as { id: string; name: string; email: string }[] }),
    thread.contact_address
      ? supabase
          .from("inbox_threads")
          .select("id, channel, subject, last_message_at")
          .eq("workspace_id", workspaceId)
          .eq("contact_address", thread.contact_address)
          .neq("id", thread.id)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(5)
      : Promise.resolve({ data: [] as { id: string; channel: string; subject: string | null; last_message_at: string | null }[] }),
  ])
  const matchingContacts = contactRows ?? []
  const workspaceContact = matchingContacts.length === 1 ? matchingContacts[0] : null
  const ambiguousContactMatch = matchingContacts.length > 1
  const recent = recentRows ?? []
  const integrations = integration ?? []
  const settings = (integrations.find((i) => i.provider === "imap") ?? integrations[0])
    ?.config as { categories?: string[] } | undefined
  const categories = settings?.categories?.length ? settings.categories : DEFAULT_CATEGORIES
  // Se responde por la misma cuenta por la que llegó la conversación.
  const provider =
    thread.channel === "telegram" || thread.channel === "whatsapp" ? thread.channel : thread.external_id.startsWith("imap:") ? "imap" : "gmail"
  const channelIntegration = integrations.find((i) => i.provider === provider)
  const canReply = channelIntegration?.status === "active" && (thread.channel === "telegram" || thread.channel === "whatsapp" || Boolean(thread.contact_address))
  const who = thread.contact_name ?? thread.contact_address ?? "Sin nombre"

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <section className="min-w-0 flex flex-col gap-4">
        <PageHeader
          eyebrow={<Link href={base} className="text-link underline underline-offset-4">Bandeja</Link>}
          title={thread.subject || who}
          description={<>{CHANNEL_LABEL[thread.channel]} · {who}{thread.contact_address && thread.contact_address !== who ? ` (${thread.contact_address})` : ""} · {thread.message_count} mensajes</>}
        />
        <div><CategoryChip workspaceId={workspaceId} threadId={thread.id} category={thread.category} categories={categories} source={thread.category_source} /></div>
        {thread.summary ? <PanelCard title="Resumen"><p className="text-sm leading-relaxed text-ink">{thread.summary}</p></PanelCard> : null}

        <div>
          {thread.channel === "phone" || thread.channel === "web" ? (
            <p className="text-sm text-graphite">
              {thread.channel === "web" ? "Conversación atendida por el asistente de voz de tu web." : "Llamada atendida por el agente telefónico."}{" "}
              {thread.contact_address ? (
                <a href={`tel:${thread.contact_address.replace(/[^\d+]/g, "")}`} className="font-semibold text-link underline underline-offset-4">
                  Llamar a {thread.contact_address}
                </a>
              ) : null}
            </p>
          ) : canReply ? (
            <ReplyComposer workspaceId={workspaceId} threadId={thread.id} channel={thread.channel} to={who} />
          ) : (
            <p className="text-sm text-graphite">
              {channelIntegration
                ? "No se puede responder: la conexión no está activa o falta la dirección del contacto."
                : provider === "gmail"
                  ? "Esta conversación llegó por la antigua integración de Gmail. Conecta Gmail como correo IMAP para seguir la conversación."
                  : `Conecta ${provider === "imap" ? "tu correo" : "el bot de Telegram"} para responder desde aquí.`}
            </p>
          )}
        </div>

        <ol className="mt-6 flex flex-col gap-3" aria-label="Mensajes, del más reciente al más antiguo">
          {(messages ?? []).map((m) => (
            <li key={m.id} className={m.direction === "out" ? "flex justify-end" : ""}>
              <div className={`thread-message max-w-[85%] border px-3 py-2 ${m.direction === "out" ? "is-outgoing border-rule bg-paper" : "is-incoming border-ink bg-sheet"}`}>
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

      <aside className="flex h-fit flex-col gap-4">
        {thread.contact_address ? (
          <PanelCard title="Contacto y contexto" className="thread-sidebar-card">
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-semibold text-ink">{workspaceContact?.name ?? who}</p>
              <p className="text-graphite">{thread.contact_address}</p>
              {workspaceContact ? (
                <p className="text-xs text-graphite">Contacto guardado en este espacio · coincidencia exacta de email</p>
              ) : ambiguousContactMatch ? (
                <p className="text-xs text-graphite">Hay varios contactos con este email. No se ha elegido ninguno.</p>
              ) : normalizedAddress.includes("@") ? (
                <p className="text-xs text-graphite">No figura como contacto guardado en este espacio.</p>
              ) : (
                <p className="text-xs text-graphite">La ficha de contactos actual guarda emails; este identificador no se ha asociado a un contacto.</p>
              )}
            </div>
            {recent.length ? (
              <div className="mt-4 border-t border-rule pt-3">
                <h3 className="mb-2 text-sm font-semibold text-ink">Conversaciones con el mismo identificador</h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`${base}/${r.id}`} className="text-link underline underline-offset-4">
                        {r.subject || "(sin asunto)"}
                      </Link>
                      <p className="text-xs text-graphite">{CHANNEL_LABEL[r.channel] ?? r.channel}{r.last_message_at ? ` · ${formatDateTime(r.last_message_at)}` : ""}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-graphite">Coincidir en el identificador no confirma por sí solo que sea la misma persona.</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-graphite">No hay otras conversaciones con este identificador.</p>
            )}
            {thread.channel === "email" ? (
              <div className="mt-4 border-t border-rule pt-3">
                <h3 className="mb-2 text-sm font-semibold text-ink">Información de aplicaciones conectadas</h3>
                <SenderProfileCard workspaceId={workspaceId} threadId={thread.id} />
              </div>
            ) : null}
          </PanelCard>
        ) : null}
      <PanelCard title="Clasificación" className="thread-sidebar-card">
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
      </PanelCard>
      </aside>
    </div>
  )
}
