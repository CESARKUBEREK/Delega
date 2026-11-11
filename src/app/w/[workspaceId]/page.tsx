import Link from "next/link"
import { Suspense } from "react"
import { runOrigin } from "@/lib/labels"
import { asPending, pendingKind, pendingTitle } from "@/lib/pending"
import { createClient } from "@/lib/supabase/server"
import { setupStatus } from "@/lib/setup"
import { getTrialStatus } from "@/lib/trial"
import { getIncludedUsage } from "@/lib/usage"
import { SOLO_PLAN, SOLO_UPGRADE_IS_EXTERNAL, SOLO_UPGRADE_URL } from "@/lib/upgrade"
import { getWorkspace } from "@/lib/workspace"
import { formatToday, formatWhen, greeting } from "./format"

export const metadata = { title: "Hoy" }

// Hoy: lo que te necesita ahora (aprobaciones), el último resumen y lo que
// viene. Es la pantalla de entrada del espacio, sobre todo en el celular.
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
      supabase.from("workspaces").select("timezone, onboarding_completed_at").eq("id", workspaceId).maybeSingle(),
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
  const onboarded = Boolean(ws?.onboarding_completed_at)
  const [setup, trial, included] = await Promise.all([
    setupStatus(workspaceId),
    getTrialStatus(workspaceId),
    aiActive ? Promise.resolve(null) : getIncludedUsage(workspaceId),
  ])
  // Sin IA propia: la IA incluida en el plan (decisión del 11 nov) o, si no hay
  // plan, la prueba gratuita (14 días o 1 USD), que sigue o se ha terminado.
  const trialActive = !aiActive && !included && onboarded && trial !== null && trial.usdRemaining > 0
  const trialEnded = !aiActive && !included && onboarded && trial !== null && trial.usdRemaining <= 0
  const aiReady = aiActive || (included !== null && !included.exhausted)
  const periodEnd = included
    ? new Intl.DateTimeFormat("es", { day: "numeric", month: "long", timeZone: timezone }).format(new Date(included.periodEnd))
    : ""
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
          <span className={`today-hero-state ${aiReady ? "is-ready" : "is-setup"}`}>
            <i aria-hidden="true" /> {aiActive ? "IA conectada" : included ? (included.exhausted ? "Tareas agotadas" : "IA incluida") : "IA por conectar"}
          </span>
          <span className="today-hero-pending"><strong>{pendingTotal}</strong><span>{pendingTotal === 1 ? "aprobación pendiente" : "aprobaciones pendientes"}</span></span>
        </aside>
      </header>

      <section className="today-command" aria-label="Pide algo a MarchaSolo">
        <div className="today-command-copy">
          <p className="today-command-title">¿Qué necesitas resolver hoy?</p>
          <p className="today-command-description">Cuéntaselo a MarchaSolo con tus palabras. Tu equipo digital te ayuda a dar el siguiente paso.</p>
        </div>
        <form action={`${base}/asistente`} method="get" role="search" aria-label="Pide algo a MarchaSolo" className="today-ask">
          <label htmlFor="hoy-pedir" className="sr-only">Pide algo a MarchaSolo</label>
          <input id="hoy-pedir" name="q" type="text" autoComplete="off" maxLength={2000} placeholder="Ej.: prepara una respuesta para este cliente…" className="today-ask-input" />
          <button type="submit" aria-label="Seguir en el chat" className="today-ask-button">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </section>

      {included && isAdmin ? (
        // IA incluida en el plan: tareas del mes, aviso del 80 % y pausa del 100 %.
        <section
          className="setup-banner flex-wrap"
          aria-labelledby="tareas-del-mes"
          {...(included.exhausted || included.nearLimit ? { role: "status" } : {})}
        >
          <span className="setup-banner-ring" aria-hidden="true" style={{ ["--pct" as string]: `${Math.min(100, Math.round((included.tasksUsed / Math.max(1, included.tasksAllowance)) * 100))}%` }}>
            {Math.min(100, Math.round((included.tasksUsed / Math.max(1, included.tasksAllowance)) * 100))}%
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span id="tareas-del-mes" className="font-semibold text-ink">
              {included.exhausted
                ? "Llegaste al límite de tareas de este mes"
                : `Tareas este mes: ${included.tasksUsed} de ${included.tasksAllowance}`}
            </span>
            <span className="text-sm text-graphite">
              {included.exhausted
                ? `Lo que usa IA está en pausa hasta el ${periodEnd}. Las aprobaciones siguen funcionando. Si no quieres esperar, conecta tu propia IA y sigue sin límite.`
                : included.nearLimit
                ? `Te quedan ${included.tasksLeft} tareas hasta el ${periodEnd}. Al llegar al límite, lo que usa IA se pausa; nunca te cobramos de más.`
                : `La IA va incluida en tu plan. El cupo se renueva el ${periodEnd}.`}
            </span>
          </span>
          {included.exhausted || included.nearLimit ? (
            <Link href={`${base}/integraciones#llms`} className="setup-banner-cta">
              Conectar mi propia IA →
            </Link>
          ) : null}
        </section>
      ) : isAdmin && trialEnded ? (
        // Al acabar la prueba: invitación al plan Solo (decisión del 7 nov).
        <section className="setup-banner flex-wrap" aria-labelledby="prueba-terminada">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span id="prueba-terminada" className="font-semibold text-ink">Tu prueba gratuita ha terminado</span>
            <span className="text-sm text-graphite">
              Con Solo, MarchaSolo sigue trabajando por ti: {SOLO_PLAN.monthlyTasks} tareas al mes por {SOLO_PLAN.price}. O conecta tu
              propia IA y sigue sin límite de tareas.
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-3">
            <a
              href={SOLO_UPGRADE_URL}
              className="setup-banner-cta"
              {...(SOLO_UPGRADE_IS_EXTERNAL ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              Pasar al plan Solo →
            </a>
            <Link href={`${base}/integraciones#llms`} className="text-sm font-semibold text-link underline underline-offset-4">
              Conectar mi propia IA
            </Link>
          </span>
        </section>
      ) : isAdmin && trialActive ? (
        <Link href={`${base}/automatizaciones`} className="setup-banner">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-ink">Estás usando la prueba gratuita</span>
            <span className="text-sm text-graphite">
              Tus automatizaciones funcionan con nuestra IA, sin conectar nada todavía.
            </span>
          </span>
          <span className="setup-banner-cta">Mis automatizaciones →</span>
        </Link>
      ) : isAdmin && !setup.ia ? (
        // Sin IA: antes del onboarding, al onboarding; después, a conectar la IA.
        <Link href={onboarded ? `${base}/integraciones#llms` : `${base}/onboarding`} className="setup-banner">
          <span className="setup-banner-ring" aria-hidden="true" style={{ ["--pct" as string]: `${Math.round((setup.done / setup.total) * 100)}%` }}>
            {setup.done}/{setup.total}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-ink">{onboarded ? "Conecta una IA para que MarchaSolo pueda trabajar" : "¡Pongamos a rodar MarchaSolo!"}</span>
            <span className="text-sm text-graphite">
              {onboarded
                ? "Falta la clave de OpenAI, Anthropic, DeepSeek o Grok. Con ella, tu plan ya puede ejecutarse."
                : "Cuéntanos una tarea y te guiamos paso a paso. No hace falta conectarlo todo de golpe."}
            </span>
          </span>
          <span className="setup-banner-cta">{onboarded ? "Conectar la IA →" : "Empezar →"}</span>
        </Link>
      ) : isAdmin && !setup.complete ? (
        // Con IA y conexiones por hacer: a Integraciones.
        <Link href={`${base}/integraciones`} className="setup-banner">
          <span className="setup-banner-ring" aria-hidden="true" style={{ ["--pct" as string]: `${Math.round((setup.done / setup.total) * 100)}%` }}>
            {setup.done}/{setup.total}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-ink">Saca más partido a MarchaSolo</span>
            <span className="text-sm text-graphite">Conecta el resto de tus cuentas: correo, Drive, calendario y mensajería.</span>
          </span>
          <span className="setup-banner-cta">Continuar →</span>
        </Link>
      ) : !aiActive && !included && !isAdmin ? (
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
          <div className="today-empty rounded-2xl border border-rule bg-sheet px-5 py-5">
            <p className="font-semibold text-ink">Todo al día. No tienes nada que aprobar.</p>
            <p className="mt-1 text-sm text-graphite">Cuando MarchaSolo prepare una acción que necesite tu permiso, aparecerá aquí.</p>
            <Link href={`${base}/asistente`} className="mt-3 inline-flex text-sm font-semibold text-link underline underline-offset-4">
              Pedir otra tarea →
            </Link>
          </div>
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
