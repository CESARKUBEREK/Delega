import Link from "next/link"
import { Suspense } from "react"
import { businessDaysAgo, CHANNEL_LABEL, DEFAULT_CATEGORIES, DEFAULT_DRAFTS_PER_DAY, FOLLOWUP_BUSINESS_DAYS } from "@/lib/inbox"
import { asPending } from "@/lib/pending"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { ApprovalCard, RunControls } from "../ejecuciones/[runId]/run-live"
import { formatDateTime } from "../format"
import { CardActions } from "./card-actions"
import { InboxSettingsForm, SyncButton } from "./classify-button"
import { deleteInboxRule } from "./inbox-actions"
import { InboxList, type ListThread } from "./inbox-list"

export const metadata = { title: "Bandeja" }
export const maxDuration = 120

type InboxSettings = { categories?: string[]; retention_days?: number | null; drafts_per_day?: number }

export default function InboxPage({ params, searchParams }: PageProps<"/w/[workspaceId]/bandeja">) {
  return (
    <div className="inbox-page flex flex-col gap-6">
      <div className="inbox-page-intro">
        <p className="app-eyebrow">MENSAJES Y SEGUIMIENTO</p>
        <h1 className="rotulo text-2xl">Bandeja</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Lo que hay que hacer hoy con tus mensajes, con las respuestas ya preparadas. Nada se envía sin que lo apruebes.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
        <Inbox params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function Inbox({ params, searchParams }: Pick<PageProps<"/w/[workspaceId]/bandeja">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const sp = await searchParams
  const base = `/w/${workspaceId}/bandeja`
  const { isAdmin } = await getWorkspace(workspaceId, base)
  if (!isAdmin) {
    return <p className="text-graphite">La bandeja solo la ven los administradores del espacio.</p>
  }

  const supabase = await createClient()
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, status, config")
    .eq("workspace_id", workspaceId)
    .in("provider", ["imap", "telegram", "whatsapp"])
  const imap = (integrations ?? []).find((i) => i.provider === "imap")
  const mailActive = imap?.status === "active"
  const settings = ((imap ?? integrations?.[0])?.config ?? {}) as InboxSettings
  const categories = settings.categories?.length ? settings.categories : DEFAULT_CATEGORIES
  if (!integrations?.length) {
    return (
      <p className="text-graphite">
        Conecta tu correo, WhatsApp o un bot de Telegram en{" "}
        <Link href={`/w/${workspaceId}/integraciones`} className="text-link underline underline-offset-4">
          Integraciones
        </Link>{" "}
        para ver aquí tus conversaciones.
      </p>
    )
  }

  const view = sp.vista === "todo" ? "todo" : "hoy"
  const { data: all } = await supabase
    .from("inbox_threads")
    .select("message_count, classified_count, automatic")
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
  const total = (all ?? []).length
  const pending = (all ?? []).filter((t) => t.message_count > t.classified_count).length
  const { data: rules } = await supabase.from("inbox_rules").select("id, match_type, value, category").eq("workspace_id", workspaceId).order("created_at")

  const today = view === "hoy" ? await todayData(supabase, workspaceId) : null
  const todayCount = today ? today.replies.length + today.followups.length : await countToday(supabase, workspaceId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-ink bg-sheet px-4 py-3">
        <p className="text-sm text-graphite" role="status">
          {pending > 0 ? (
            <>
              <span className="inbox-progress" aria-hidden="true">
                <span style={{ width: `${Math.round(((total - pending) / Math.max(1, total)) * 100)}%` }} />
              </span>
              Ordenando tu bandeja: {total - pending} de {total}. Puedes seguir trabajando.
            </>
          ) : (
            `${total} conversaciones, todas ordenadas.`
          )}
        </p>
        {mailActive ? <SyncButton workspaceId={workspaceId} /> : null}
      </div>
      {imap && imap.status !== "active" ? (
        <p className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
          Tu servidor de correo rechazó la contraseña.{" "}
          <Link href={`/w/${workspaceId}/integraciones#comunicaciones`} className="underline underline-offset-4">
            Vuelve a escribirla
          </Link>
          .
        </p>
      ) : null}

      <nav className="inbox-tabs" aria-label="Vistas de la bandeja">
        <Link href={base} className={view === "hoy" ? "is-active" : ""} aria-current={view === "hoy" ? "page" : undefined}>
          Para hoy{todayCount ? ` · ${todayCount}` : ""}
        </Link>
        <Link href={`${base}?vista=todo`} className={view === "todo" ? "is-active" : ""} aria-current={view === "todo" ? "page" : undefined}>
          Todo
        </Link>
      </nav>

      {today ? (
        <TodayView workspaceId={workspaceId} base={base} data={today} mailActive={mailActive} draftsPerDay={settings.drafts_per_day ?? DEFAULT_DRAFTS_PER_DAY} />
      ) : (
        <AllView workspaceId={workspaceId} base={base} sp={sp} categories={categories} mailActive={mailActive} total={total} />
      )}

      <details className="border border-rule bg-sheet px-4 py-3 text-sm">
        <summary className="cursor-pointer text-ink">Ajustes de la bandeja</summary>
        <div className="mt-3 flex flex-col gap-6">
          <InboxSettingsForm
            workspaceId={workspaceId}
            categories={categories}
            retentionDays={settings.retention_days ?? null}
            draftsPerDay={settings.drafts_per_day ?? DEFAULT_DRAFTS_PER_DAY}
          />
          <section aria-labelledby="inbox-rules" className="flex flex-col gap-2">
            <h2 id="inbox-rules" className="font-semibold text-ink">
              Reglas
            </h2>
            <p className="text-xs text-graphite">Se crean al cambiar la categoría de una conversación («¿Siempre para…?»). Se aplican antes que la IA.</p>
            {rules?.length ? (
              <ul className="divide-y divide-rule border border-rule">
                {rules.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate">
                      {r.match_type === "domain" ? `Todo @${r.value}` : r.value} → <span className="font-semibold">{r.category}</span>
                    </span>
                    <form action={deleteInboxRule}>
                      <input type="hidden" name="workspaceId" value={workspaceId} />
                      <input type="hidden" name="ruleId" value={r.id} />
                      <button type="submit" className="text-sm text-link underline underline-offset-4">
                        Borrar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-graphite">Aún no hay reglas.</p>
            )}
          </section>
        </div>
      </details>
    </div>
  )
}

type Supabase = Awaited<ReturnType<typeof createClient>>

type CardThread = {
  id: string
  channel: string
  subject: string | null
  contact_name: string | null
  contact_address: string | null
  urgency: string | null
  summary: string | null
  last_message_at: string | null
  last_direction_at: string | null
  known_contact: boolean
  prepare_run_id: string | null
}

const CARD_FIELDS = "id, channel, subject, contact_name, contact_address, urgency, summary, last_message_at, last_direction_at, known_contact, prepare_run_id"
const URGENCY_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 }

function repliesQuery(supabase: Supabase, workspaceId: string) {
  return supabase
    .from("inbox_threads")
    .select(CARD_FIELDS)
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .eq("automatic", false)
    .eq("needs_reply", true)
    .eq("last_direction", "in")
    .is("prepare_dismissed_at", null)
    .gte("last_message_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
}

function followupsQuery(supabase: Supabase, workspaceId: string) {
  return supabase
    .from("inbox_threads")
    .select(CARD_FIELDS)
    .eq("workspace_id", workspaceId)
    .eq("archived", false)
    .eq("automatic", false)
    .eq("followup_muted", false)
    .eq("channel", "email")
    .eq("last_direction", "out")
    .lt("last_direction_at", businessDaysAgo(FOLLOWUP_BUSINESS_DAYS).toISOString())
    .gte("last_direction_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
}

async function countToday(supabase: Supabase, workspaceId: string): Promise<number> {
  const [{ data: a }, { data: b }] = await Promise.all([repliesQuery(supabase, workspaceId).limit(50), followupsQuery(supabase, workspaceId).limit(20)])
  return (a?.length ?? 0) + (b?.length ?? 0)
}

async function todayData(supabase: Supabase, workspaceId: string) {
  const [{ data: replies }, { data: followups }, { count: noise }, { count: preparedToday }] = await Promise.all([
    repliesQuery(supabase, workspaceId).order("last_message_at", { ascending: false }).limit(50),
    followupsQuery(supabase, workspaceId).order("last_direction_at", { ascending: true }).limit(20),
    supabase
      .from("inbox_threads")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("archived", false)
      .eq("automatic", true)
      .gte("last_message_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabase
      .from("flow_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("trigger->>type", "inbox_prepare")
      .gte("started_at", new Date(Date.now() - 86_400_000).toISOString()),
  ])
  const threads = [...((replies ?? []) as CardThread[]), ...((followups ?? []) as CardThread[])]
  const runIds = threads.map((t) => t.prepare_run_id).filter((id): id is string => Boolean(id))
  const { data: runs } = runIds.length
    ? await supabase.from("flow_runs").select("id, status, pending_action, summary, started_at, trigger").in("id", runIds)
    : { data: [] }
  const sorted = ((replies ?? []) as CardThread[]).sort(
    (a, b) =>
      (URGENCY_ORDER[a.urgency ?? "media"] ?? 1) - (URGENCY_ORDER[b.urgency ?? "media"] ?? 1) ||
      Number(b.known_contact) - Number(a.known_contact) ||
      (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
  )
  return { replies: sorted, followups: (followups ?? []) as CardThread[], runs: runs ?? [], noise: noise ?? 0, preparedToday: preparedToday ?? 0 }
}

function TodayView({
  workspaceId,
  base,
  data,
  mailActive,
  draftsPerDay,
}: {
  workspaceId: string
  base: string
  data: Awaited<ReturnType<typeof todayData>>
  mailActive: boolean
  draftsPerDay: number
}) {
  const runOf = (t: CardThread, mode: "reply" | "followup") => {
    const run = data.runs.find((r) => r.id === t.prepare_run_id)
    if (!run) return null
    // Una ejecución vale para esta tarjeta si es del mismo tipo y posterior al
    // último mensaje que la originó.
    if ((run.trigger as { mode?: string } | null)?.mode !== mode) return null
    if (t.last_direction_at && run.started_at < t.last_direction_at) return null
    return run
  }
  const empty = data.replies.length === 0 && data.followups.length === 0
  const left = Math.max(0, draftsPerDay - data.preparedToday)

  return (
    <div className="flex flex-col gap-3">
      {empty ? (
        <div className="today-empty">
          <p className="font-semibold text-ink">Nada pendiente para hoy</p>
          <p className="text-sm text-graphite">
            Cuando alguien espere tu respuesta, aparecerá aquí con el borrador listo.{" "}
            <Link href={`${base}?vista=todo`} className="text-link underline underline-offset-4">
              Ver todos los mensajes
            </Link>
          </p>
        </div>
      ) : null}

      {data.replies.map((t) => {
        const run = runOf(t, "reply")
        return <TodayCard key={t.id} workspaceId={workspaceId} base={base} thread={t} run={run} mode="reply" mailActive={mailActive} />
      })}
      {data.followups.length ? (
        <h2 className="mt-2 text-sm font-semibold text-graphite">Sin respuesta desde hace {FOLLOWUP_BUSINESS_DAYS} días laborables o más</h2>
      ) : null}
      {data.followups.map((t) => {
        const run = runOf(t, "followup")
        return <TodayCard key={t.id} workspaceId={workspaceId} base={base} thread={t} run={run} mode="followup" mailActive={mailActive} />
      })}

      {data.noise > 0 ? (
        <Link href={`${base}?vista=todo&auto=1`} className="today-noise">
          <span>Boletines y avisos de la última semana ({data.noise})</span>
          <span aria-hidden="true">›</span>
        </Link>
      ) : null}
      {mailActive ? (
        <p className="text-xs text-graphite">
          Las respuestas a lo urgente y a tus contactos se preparan solas al llegar: {left} de {draftsPerDay} disponibles en las últimas 24 h. Para el resto,
          «Preparar respuesta».
        </p>
      ) : null}
    </div>
  )
}

function TodayCard({
  workspaceId,
  base,
  thread: t,
  run,
  mode,
  mailActive,
}: {
  workspaceId: string
  base: string
  thread: CardThread
  run: { id: string; status: string; pending_action: unknown; summary: string | null } | null
  mode: "reply" | "followup"
  mailActive: boolean
}) {
  const who = t.contact_name ?? t.contact_address ?? "Sin nombre"
  const pending = run?.status === "awaiting_approval" ? asPending(run.pending_action as Parameters<typeof asPending>[0]) : null
  const canPrepare = mailActive && t.channel === "email" && Boolean(t.contact_address)
  return (
    <article className={`today-card ${t.urgency === "alta" && mode === "reply" ? "is-urgent" : ""}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`${base}/${t.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
          {who}
          <span className="ml-2 text-xs font-normal text-graphite">{CHANNEL_LABEL[t.channel]}</span>
        </Link>
        <span className="flex items-center gap-2 text-xs text-graphite">
          {mode === "reply" && t.urgency === "alta" ? <span className="today-badge">Urgente</span> : null}
          {t.known_contact ? <span className="today-badge is-known">Contacto</span> : null}
          {mode === "followup" && t.last_direction_at ? `Le escribiste el ${formatDateTime(t.last_direction_at)}` : t.last_message_at ? formatDateTime(t.last_message_at) : ""}
        </span>
      </header>
      <p className="text-sm text-graphite">{mode === "followup" ? `No ha contestado${t.subject ? ` a «${t.subject}»` : ""}.` : (t.summary ?? t.subject ?? "")}</p>

      {pending && run ? (
        <ApprovalCard runId={run.id} pending={pending} />
      ) : run?.status === "running" ? (
        <RunControls runId={run.id} status="running" workingText={mode === "followup" ? "Preparando el recordatorio…" : "Preparando la respuesta…"} />
      ) : (
        <>
          {run && run.status !== "awaiting_approval" && run.summary ? (
            <p className="border-l-2 border-rule pl-3 text-xs text-graphite">
              Última propuesta: {run.summary.slice(0, 240)}{" "}
              <Link href={`/w/${workspaceId}/ejecuciones/${run.id}`} className="text-link underline underline-offset-4">
                Ver
              </Link>
            </p>
          ) : null}
          <CardActions
            workspaceId={workspaceId}
            threadId={t.id}
            mode={mode}
            canPrepare={canPrepare}
            prepareLabel={mode === "followup" ? "Preparar recordatorio" : run ? "Preparar de nuevo" : "Preparar respuesta"}
          />
          {!canPrepare && mode === "reply" ? (
            <Link href={`${base}/${t.id}`} className="text-sm text-link underline underline-offset-4">
              Abrir y responder
            </Link>
          ) : null}
        </>
      )}
    </article>
  )
}

function AllView({
  workspaceId,
  base,
  sp,
  categories,
  mailActive,
  total,
}: {
  workspaceId: string
  base: string
  sp: Record<string, string | string[] | undefined>
  categories: string[]
  mailActive: boolean
  total: number
}) {
  return (
    <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
      <AllList workspaceId={workspaceId} base={base} sp={sp} categories={categories} mailActive={mailActive} total={total} />
    </Suspense>
  )
}

async function AllList({
  workspaceId,
  base,
  sp,
  categories,
  mailActive,
  total,
}: {
  workspaceId: string
  base: string
  sp: Record<string, string | string[] | undefined>
  categories: string[]
  mailActive: boolean
  total: number
}) {
  const supabase = await createClient()
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "")
  const cat = one("cat")
  const ch = ["email", "telegram", "whatsapp", "phone"].includes(one("ch")) ? one("ch") : ""
  const urg = one("urg")
  const reply = one("reply") === "1"
  const archived = one("arch") === "1"
  const auto = one("auto") === "1"
  const q = one("q").trim().slice(0, 80)

  let query = supabase
    .from("inbox_threads")
    .select(
      "id, channel, subject, contact_name, contact_address, category, category_source, client, project, urgency, needs_reply, summary, last_message_at, message_count, classified_count",
    )
    .eq("workspace_id", workspaceId)
    .eq("archived", archived)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200)
  // Los boletines y avisos van aparte, salvo al buscar o filtrar por categoría.
  if (!q && !cat) query = query.eq("automatic", auto)
  if (cat) query = query.eq("category", cat)
  if (ch) query = query.eq("channel", ch)
  if (urg) query = query.eq("urgency", urg)
  if (reply) query = query.eq("needs_reply", true)
  if (q) {
    const safe = q.replace(/[%_,()*]/g, " ")
    query = query.or(`contact_name.ilike.%${safe}%,contact_address.ilike.%${safe}%,subject.ilike.%${safe}%,client.ilike.%${safe}%,project.ilike.%${safe}%`)
  }
  const [{ data: threads }, { count: autoCount }] = await Promise.all([
    query,
    supabase.from("inbox_threads").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("archived", archived).eq("automatic", true),
  ])

  const filterHref = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      vista: "todo",
      ...(cat && { cat }),
      ...(ch && { ch }),
      ...(urg && { urg }),
      ...(reply && { reply: "1" }),
      ...(archived && { arch: "1" }),
      ...(auto && { auto: "1" }),
      ...(q && { q }),
    })
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    return `${base}?${next.toString()}`
  }
  const chip = (active: boolean) => "inbox-filter-chip" + (active ? " is-active" : "")
  const rows: ListThread[] = (threads ?? []).map((t) => ({
    id: t.id,
    channel: t.channel,
    subject: t.subject,
    who: t.contact_name ?? t.contact_address ?? "Sin nombre",
    category: t.category,
    category_source: t.category_source,
    urgency: t.urgency,
    needs_reply: Boolean(t.needs_reply),
    client: t.client,
    project: t.project,
    summary: t.summary,
    when: t.last_message_at ? formatDateTime(t.last_message_at) : "",
    pending: t.message_count > t.classified_count,
  }))

  return (
    <div className="flex flex-col gap-4">
      <form action={base} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="vista" value="todo" />
        {cat ? <input type="hidden" name="cat" value={cat} /> : null}
        {ch ? <input type="hidden" name="ch" value={ch} /> : null}
        {urg ? <input type="hidden" name="urg" value={urg} /> : null}
        {reply ? <input type="hidden" name="reply" value="1" /> : null}
        {archived ? <input type="hidden" name="arch" value="1" /> : null}
        <label htmlFor="inbox-q" className="sr-only">
          Buscar
        </label>
        <input
          id="inbox-q"
          name="q"
          defaultValue={q}
          placeholder="Buscar contacto, asunto, cliente u obra…"
          className="h-9 min-w-0 flex-1 border border-rule bg-sheet px-3 text-sm text-ink focus:border-link focus:outline-none"
        />
        <button type="submit" className="h-9 border border-ink px-3 text-sm text-ink hover:bg-paper">
          Buscar
        </button>
      </form>

      <nav aria-label="Filtros de la bandeja" className="inbox-filters">
        {(["email", "whatsapp", "telegram", "phone"] as const).map((c) => (
          <Link key={c} href={filterHref({ ch: ch === c ? "" : c })} className={chip(ch === c)} aria-current={ch === c ? "page" : undefined}>
            {CHANNEL_LABEL[c]}
          </Link>
        ))}
        <span className="mx-1 w-px bg-rule" aria-hidden="true" />
        <Link href={filterHref({ cat: "" })} className={chip(!cat)} aria-current={!cat ? "page" : undefined}>
          Todas
        </Link>
        {categories.map((c) => (
          <Link key={c} href={filterHref({ cat: c })} className={chip(cat === c)} aria-current={cat === c ? "page" : undefined}>
            {c}
          </Link>
        ))}
        <span className="mx-1 w-px bg-rule" aria-hidden="true" />
        {(["alta", "media", "baja"] as const).map((u) => (
          <Link key={u} href={filterHref({ urg: urg === u ? "" : u })} className={chip(urg === u)} aria-current={urg === u ? "page" : undefined}>
            Urgencia {u}
          </Link>
        ))}
        <Link href={filterHref({ reply: reply ? "" : "1" })} className={chip(reply)} aria-current={reply ? "page" : undefined}>
          Necesita respuesta
        </Link>
        <Link href={filterHref({ arch: archived ? "" : "1" })} className={chip(archived)} aria-current={archived ? "page" : undefined}>
          Archivadas
        </Link>
      </nav>

      {!q && !cat && (autoCount ?? 0) > 0 ? (
        <Link href={filterHref({ auto: auto ? "" : "1" })} className="today-noise">
          <span>{auto ? "Volver a los mensajes" : `Boletines y avisos (${autoCount})`}</span>
          <span aria-hidden="true">{auto ? "‹" : "›"}</span>
        </Link>
      ) : null}

      {rows.length > 0 ? (
        <InboxList workspaceId={workspaceId} base={base} threads={rows} categories={categories} archived={archived} />
      ) : (
        <p className="text-sm text-graphite">
          {total === 0
            ? mailActive
              ? "Aún no hay conversaciones. Pulsa «Traer correo» para importar los 400 correos más recientes de los últimos 30 días."
              : "Aún no ha llegado ningún mensaje a tu bot."
            : "Ninguna conversación coincide con los filtros."}
        </p>
      )}
    </div>
  )
}
