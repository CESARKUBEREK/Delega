import Link from "next/link"
import { Suspense } from "react"
import { runOrigin } from "@/lib/labels"
import { asPending, pendingKind, pendingTitle } from "@/lib/pending"
import { createClient } from "@/lib/supabase/server"
import { setupStatus } from "@/lib/setup"
import { getWorkspace } from "@/lib/workspace"
import { formatToday, formatWhen, greeting } from "./format"

export const metadata = { title: "Hoy" }

// Hoy: lo que te necesita ahora (aprobaciones), el último resumen y lo que
// viene. Es la pantalla de entrada del espacio, sobre todo en el móvil.
export default function TodayPage({ params }: PageProps<"/w/[workspaceId]">) {
  return (
    <Suspense fallback={<div className="h-64 rounded-2xl border border-rule bg-sheet" aria-busy="true" />}>
      <Today params={params} />
    </Suspense>
  )
}

async function Today({ params }: { params: PageProps<"/w/[workspaceId]">["params"] }) {
  const { workspaceId } = await params
  const { user, isAdmin } = await getWorkspace(workspaceId)
  const supabase = await createClient()
  const base = `/w/${workspaceId}`

  // La RLS decide qué ejecuciones se ven: las propias o, a un administrador,
  // todas las del espacio.
  const [{ data: ws }, { data: profile }, { data: connections }, { data: waiting, count: waitingCount }, { data: lastSummary }, { data: upcoming }, { count: flowCount }] =
    await Promise.all([
      supabase.from("workspaces").select("timezone").eq("id", workspaceId).maybeSingle(),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId),
      supabase
        .from("flow_runs")
        .select("id, flow_name, pending_action, trigger, updated_at", { count: "exact" })
        .eq("workspace_id", workspaceId)
        .eq("status", "awaiting_approval")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("flow_runs")
        .select("id, flow_name, summary, finished_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "succeeded")
        .not("summary", "is", null)
        .neq("summary", "")
        .order("finished_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("flows")
        .select("id, name, next_run_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .not("next_run_at", "is", null)
        .order("next_run_at")
        .limit(4),
      supabase.from("flows").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    ])

  const timezone = ws?.timezone || "Europe/Madrid"
  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0]
  const aiActive = (connections ?? []).some((c) => c.status === "active")
  const setup = await setupStatus(workspaceId)
  const pendingTotal = waitingCount ?? (waiting ?? []).length

  return (
    <div className="today flex flex-col gap-7">
      <header className="today-hero">
        <div className="today-hero-main">
          <p className="today-hero-kicker"><span aria-hidden="true" /> CENTRO DE CONTROL</p>
          <p className="today-hero-date">{formatToday(timezone)}</p>
          <h1 className="rotulo">
            {greeting(timezone)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="today-hero-description">Tus aprobaciones, actividad y próximas automatizaciones, en un solo lugar.</p>
        </div>
        <aside className="today-hero-status" aria-label="Estado del espacio">
          <span className="today-hero-status-label">ESTADO DEL ASISTENTE</span>
          <span className={`today-hero-state ${aiActive ? "is-ready" : "is-setup"}`}>
            <i aria-hidden="true" /> {aiActive ? "IA conectada" : "IA por conectar"}
          </span>
          <span className="today-hero-pending"><strong>{pendingTotal}</strong><span>{pendingTotal === 1 ? "aprobación pendiente" : "aprobaciones pendientes"}</span></span>
        </aside>
      </header>

      {isAdmin && !setup.complete ? (
        <Link href={`${base}/bienvenida`} className="setup-banner">
          <span className="setup-banner-ring" aria-hidden="true" style={{ ["--pct" as string]: `${Math.round((setup.done / setup.total) * 100)}%` }}>
            {setup.done}/{setup.total}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-ink">{setup.ia ? "Termina de configurar MarchaSolo" : "Pon MarchaSolo en marcha"}</span>
            <span className="text-sm text-graphite">
              {setup.ia ? "Conecta tus cuentas paso a paso: correo, Drive, calendario y mensajería." : "Empieza conectando tu IA: sin ella, MarchaSolo no puede trabajar."}
            </span>
          </span>
          <span className="setup-banner-cta">Continuar →</span>
        </Link>
      ) : !aiActive && !isAdmin ? (
        <p className="today-callout rounded-2xl border border-rule bg-sheet px-5 py-4 text-sm text-graphite">
          Un administrador tiene que conectar la clave de una IA para que MarchaSolo pueda trabajar.
        </p>
      ) : null}

      <section aria-labelledby="hoy-necesita" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 id="hoy-necesita" className="text-lg font-bold">
            Te necesita
          </h2>
          {pendingTotal ? (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-stroke px-2 text-xs font-bold text-stroke-ink">
              <span className="sr-only">Pendientes: </span>
              {pendingTotal}
            </span>
          ) : null}
        </div>

        {(waiting ?? []).length === 0 ? (
          <p className="rounded-2xl border border-rule bg-sheet px-5 py-4 text-sm text-graphite">
            Nada pendiente. Cuando MarchaSolo quiera escribir o enviar algo, te lo pedirá aquí.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {(waiting ?? []).map((run) => {
              const pending = asPending(run.pending_action)
              return (
                <li key={run.id}>
                  <Link href={`${base}/ejecuciones/${run.id}`} className="today-card group">
                    <span className="today-card-icon" aria-hidden="true">
                      <KindIcon kind={pending ? pendingKind(pending) : "other"} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold text-ink">{pending ? pendingTitle(pending) : "Acción pendiente"}</span>
                      <span className="truncate text-sm text-graphite">
                        {run.flow_name} · {runOrigin(run.trigger)}
                      </span>
                      <span className="text-xs font-medium text-graphite">{formatWhen(run.updated_at, timezone)}</span>
                    </span>
                    <span className="self-center text-sm font-semibold text-link group-hover:underline">Revisar</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {pendingTotal > (waiting ?? []).length ? (
          <Link href={`${base}/aprobaciones`} className="w-fit text-sm font-semibold text-link underline underline-offset-4">
            Ver las {pendingTotal} pendientes
          </Link>
        ) : null}
      </section>

      {lastSummary?.summary ? (
        <section aria-labelledby="hoy-resumen" className="today-summary flex flex-col gap-3 rounded-2xl px-5 py-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="hoy-resumen" className="text-lg font-bold">
              {lastSummary.flow_name}
            </h2>
            {lastSummary.finished_at ? <span className="shrink-0 text-xs font-medium text-graphite">{formatWhen(lastSummary.finished_at, timezone)}</span> : null}
          </div>
          <p className="today-summary-text text-sm leading-relaxed whitespace-pre-line text-ink">{lastSummary.summary}</p>
          <Link href={`${base}/ejecuciones/${lastSummary.id}`} className="w-fit text-sm font-semibold text-link underline underline-offset-4">
            Ver completo
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="hoy-proximas" className="flex flex-col gap-3">
        <h2 id="hoy-proximas" className="text-lg font-bold">
          Próximas automatizaciones
        </h2>
        {(upcoming ?? []).length > 0 ? (
          <ul className="divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-sheet">
            {(upcoming ?? []).map((f) => (
              <li key={f.id}>
                <Link href={`${base}/automatizaciones/${f.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper">
                  <span className="w-28 shrink-0 text-sm font-bold text-ink">{formatWhen(f.next_run_at!, timezone)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{f.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-rule bg-sheet px-5 py-4 text-sm text-graphite">
            {flowCount ? "Ninguna automatización programada está activa." : "Todavía no tienes automatizaciones."}{" "}
            <Link href={`${base}/automatizaciones/plantillas`} className="font-semibold text-link underline underline-offset-4">
              Empieza con una de las 10 rutinas
            </Link>
            .
          </p>
        )}
      </section>

      <form action={`${base}/asistente`} method="get" role="search" aria-label="Pide algo a MarchaSolo" className="today-ask">
        <label htmlFor="hoy-pedir" className="sr-only">
          Pide algo a MarchaSolo
        </label>
        <input id="hoy-pedir" name="q" type="text" autoComplete="off" maxLength={2000} placeholder="Pide algo a MarchaSolo…" className="today-ask-input" />
        <button type="submit" aria-label="Seguir en el chat" className="today-ask-button">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  )
}

function KindIcon({ kind }: { kind: "email" | "sheet" | "doc" | "message" | "other" }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {kind === "email" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </>
      ) : kind === "sheet" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18" />
        </>
      ) : kind === "doc" ? (
        <>
          <path d="M6 3h8l4 4v14H6Z" />
          <path d="M14 3v4h4M9 12h6M9 16h6" />
        </>
      ) : kind === "message" ? (
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.2 12.3 2.6 2.6 5-5.4" />
        </>
      )}
    </svg>
  )
}
