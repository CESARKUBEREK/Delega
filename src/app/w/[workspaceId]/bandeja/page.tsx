import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { formatDateTime } from "../format"
import { ClassifyButton } from "./classify-button"

export const metadata = { title: "Bandeja" }
export const maxDuration = 120

const URGENCY_STYLE: Record<string, string> = {
  alta: "border-alert text-alert",
  media: "border-rule text-ink",
  baja: "border-rule text-graphite",
}

export default function InboxPage({ params, searchParams }: PageProps<"/w/[workspaceId]/bandeja">) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="rotulo text-2xl">Bandeja</h1>
        <p className="mt-1 max-w-prose text-graphite">
          Tus conversaciones de WhatsApp, clasificadas por la IA. Puedes corregir cualquier clasificación; Delega no responde a
          nadie sin tu aprobación.
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
    return <p className="text-graphite">La bandeja de WhatsApp solo la ven los administradores del espacio.</p>
  }

  const supabase = await createClient()
  const { data: integration } = await supabase
    .from("integrations")
    .select("status, config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "whatsapp")
    .maybeSingle()
  if (!integration) {
    return (
      <p className="text-graphite">
        Conecta WhatsApp en{" "}
        <Link href={`/w/${workspaceId}/integraciones`} className="text-stroke underline underline-offset-4">
          Integraciones
        </Link>{" "}
        para ver aquí tus conversaciones.
      </p>
    )
  }

  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "")
  const cat = one("cat")
  const urg = one("urg")
  const reply = one("reply") === "1"
  const archived = one("arch") === "1"
  const q = one("q").trim().slice(0, 80)

  let query = supabase
    .from("whatsapp_threads")
    .select("id, phone, contact_name, category, client, project, urgency, needs_reply, summary, last_message_at, message_count, classified_count")
    .eq("workspace_id", workspaceId)
    .eq("archived", archived)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200)
  if (cat) query = query.eq("category", cat)
  if (urg) query = query.eq("urgency", urg)
  if (reply) query = query.eq("needs_reply", true)
  if (q) {
    const safe = q.replace(/[%_,()*]/g, " ")
    query = query.or(`contact_name.ilike.%${safe}%,client.ilike.%${safe}%,project.ilike.%${safe}%,phone.ilike.%${safe}%`)
  }
  const [{ data: threads }, { data: all }] = await Promise.all([
    query,
    supabase.from("whatsapp_threads").select("category, message_count, classified_count").eq("workspace_id", workspaceId).eq("archived", false),
  ])

  const pending = (all ?? []).filter((t) => t.message_count > t.classified_count).length
  const categories = [...new Set((all ?? []).map((t) => t.category).filter((c): c is string => Boolean(c)))].sort()
  const filterHref = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ ...(cat && { cat }), ...(urg && { urg }), ...(reply && { reply: "1" }), ...(archived && { arch: "1" }), ...(q && { q }) })
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    const s = next.toString()
    return s ? `${base}?${s}` : base
  }
  const chip = (active: boolean) =>
    `border px-2.5 py-1 text-xs ${active ? "border-ink bg-ink text-sheet" : "border-rule text-ink hover:bg-paper"}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-ink bg-sheet px-4 py-3">
        <p className="text-sm text-graphite">
          {(all ?? []).length} conversaciones · {pending} con mensajes sin clasificar
        </p>
        <ClassifyButton workspaceId={workspaceId} pending={pending} />
      </div>

      <form action={base} className="flex flex-wrap items-center gap-2">
        {cat ? <input type="hidden" name="cat" value={cat} /> : null}
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
          placeholder="Buscar contacto, cliente u obra…"
          className="h-9 min-w-0 flex-1 border border-rule bg-sheet px-3 text-sm text-ink focus:border-stroke focus:outline-none"
        />
        <button type="submit" className="h-9 border border-ink px-3 text-sm text-ink hover:bg-paper">
          Buscar
        </button>
      </form>

      <nav aria-label="Filtros" className="flex flex-wrap gap-2">
        <Link href={filterHref({ cat: "" })} className={chip(!cat)}>
          Todas
        </Link>
        {categories.map((c) => (
          <Link key={c} href={filterHref({ cat: c })} className={chip(cat === c)}>
            {c}
          </Link>
        ))}
        <span className="mx-1 w-px bg-rule" aria-hidden="true" />
        {(["alta", "media", "baja"] as const).map((u) => (
          <Link key={u} href={filterHref({ urg: urg === u ? "" : u })} className={chip(urg === u)}>
            Urgencia {u}
          </Link>
        ))}
        <Link href={filterHref({ reply: reply ? "" : "1" })} className={chip(reply)}>
          Necesita respuesta
        </Link>
        <Link href={filterHref({ arch: archived ? "" : "1" })} className={chip(archived)}>
          Archivadas
        </Link>
      </nav>

      {threads && threads.length > 0 ? (
        <ul className="divide-y divide-rule border border-ink bg-sheet">
          {threads.map((t) => (
            <li key={t.id}>
              <Link href={`${base}/${t.id}`} className="block px-4 py-3 hover:bg-paper">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink">
                    {t.contact_name ?? `+${t.phone}`}
                    {t.needs_reply ? <span className="ml-2 text-xs font-semibold text-stroke">Responder</span> : null}
                  </span>
                  <span className="text-xs text-graphite">{t.last_message_at ? formatDateTime(t.last_message_at) : ""}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {t.category ? <span className="border border-rule px-1.5 py-0.5 text-ink">{t.category}</span> : null}
                  {t.urgency ? <span className={`border px-1.5 py-0.5 ${URGENCY_STYLE[t.urgency] ?? ""}`}>{t.urgency}</span> : null}
                  {t.client ? <span className="text-graphite">Cliente: {t.client}</span> : null}
                  {t.project ? <span className="text-graphite">· {t.project}</span> : null}
                  {t.message_count > t.classified_count ? <span className="text-graphite">· sin clasificar</span> : null}
                </div>
                {t.summary ? <p className="mt-1 line-clamp-2 text-sm text-graphite">{t.summary}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-graphite">
          {(all ?? []).length === 0
            ? "Aún no ha llegado ningún mensaje. Si acabas de conectar con coexistencia, el histórico tarda unos minutos."
            : "Ninguna conversación coincide con los filtros."}
        </p>
      )}
    </div>
  )
}
