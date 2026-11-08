"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { FlowPlan } from "@/lib/plan"
import { CONNECTION_LABEL, type OnboardingConnection } from "@/lib/onboarding"
import { checkOnboardingAi, checkOnboardingConnections, checkOnboardingTrial, getOnboardingResult, type OnboardingResult } from "@/app/w/[workspaceId]/onboarding/actions"

const Check = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export function DoneStep({
  workspaceId,
  base,
  isAdmin,
  plan,
  neededConnections,
  flowId,
  chatLink,
  stepLabel,
  onConnectAi,
  onConnectTool,
  onRestart,
}: {
  workspaceId: string
  base: string
  isAdmin: boolean
  plan: FlowPlan | null
  neededConnections: OnboardingConnection[]
  flowId: string | null
  chatLink: string
  stepLabel: string
  onConnectAi: () => void
  onConnectTool: (connection: OnboardingConnection) => void
  onRestart: () => void
}) {
  const router = useRouter()
  const [ai, setAi] = useState<{ ok: boolean; label: string | null; error?: string } | null>(null)
  const [trialRun, setTrialRun] = useState<{ available: boolean; remaining: number } | null>(null)
  const [toolCheck, setToolCheck] = useState<
    | { ok: true; statuses: Partial<Record<OnboardingConnection, boolean>> }
    | { ok: false; error: string }
    | null
  >(neededConnections.length === 0 ? { ok: true, statuses: {} } : null)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [checkVersion, setCheckVersion] = useState(0)

  useEffect(() => {
    let stop = false
    void checkOnboardingAi(workspaceId)
      .then((r) => {
        if (!stop) setAi(r.ok ? { ok: r.connected, label: r.label } : { ok: false, label: null, error: r.error })
      })
      .catch(() => !stop && setAi({ ok: false, label: null, error: "No se pudo comprobar la conexión de IA." }))
    void checkOnboardingTrial(workspaceId)
      .then((r) => {
        if (!stop) setTrialRun(r.ok ? { available: r.runAvailable, remaining: r.runsRemaining } : { available: false, remaining: 0 })
      })
      .catch(() => !stop && setTrialRun({ available: false, remaining: 0 }))
    if (neededConnections.length > 0) {
      void checkOnboardingConnections({ workspaceId, connections: neededConnections })
        .then((result) => {
          if (!stop) setToolCheck(result)
        })
        .catch(() => !stop && setToolCheck({ ok: false, error: "No se pudieron comprobar las conexiones." }))
    }
    return () => {
      stop = true
    }
  }, [workspaceId, neededConnections, checkVersion])

  const toolReady = neededConnections.every((connection) => toolCheck?.ok === true && toolCheck.statuses[connection] === true)
  const trialAiAvailable = trialRun?.available === true
  const aiAvailable = ai?.ok === true || trialAiAvailable
  const ready = aiAvailable && toolReady
  const loading = ai === null || trialRun === null || toolCheck === null
  const verificationError = (ai?.error && !trialAiAvailable ? ai.error : null) ?? (toolCheck?.ok === false ? toolCheck.error : null)

  const saveAndOpen = () => {
    if (!plan) return
    setError(null)
    startSave(async () => {
      if (!flowId) {
        setError("El borrador aún no está guardado. Vuelve a intentarlo desde el paso anterior.")
        return
      }
      router.push(`${base}/automatizaciones/${flowId}`)
    })
  }

  const primary = "inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
  const secondary = "inline-flex h-11 items-center justify-center rounded-xl border border-ink px-5 font-medium text-ink"

  const items: { label: string; ok: boolean | null; detail: string }[] = [
    { label: "Tu automatización", ok: plan !== null, detail: plan?.name ?? "" },
    {
      label: "Tu IA",
      ok: ai?.ok === true || trialAiAvailable ? true : ai?.error ? null : ai?.ok ?? (trialRun === null ? null : false),
      detail: ai?.ok
        ? (ai.label ?? "Conectada")
        : trialAiAvailable
          ? "Prueba gratuita de MarchaSolo: no hace falta conectar la tuya"
          : ai?.error ?? (trialRun === null ? "Comprobando la prueba gratuita…" : "Sin conectar: no hay IA y la prueba gratuita se ha terminado"),
    },
    ...neededConnections.map((connection) => ({
      label: CONNECTION_LABEL[connection],
      ok: toolCheck?.ok === true ? toolCheck.statuses[connection] ?? false : null,
      detail: toolCheck?.ok === false
        ? toolCheck.error
        : toolCheck?.statuses[connection] === true ? "Conectado" : "Sin conectar: lo necesita tu automatización",
    })),
  ]

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">{stepLabel}</p>
        <h2 className="rotulo text-xl mt-1">{ready ? "Preparado para probar" : loading ? "Comprobando conexiones…" : verificationError ? "No pude verificar toda la configuración" : "Configuración pendiente"}</h2>
        <p className="text-graphite mt-1">
          {ready
            ? "Tu automatización y sus conexiones están listas. Podrás probarla antes de activarla; nada se envía ni modifica sin tu aprobación."
            : loading
              ? "Estoy comprobando qué servicios están conectados."
              : verificationError ? "No voy a dar por conectada una herramienta si no he podido comprobarla. Puedes volver a intentarlo." : "Tu automatización está guardada, pero todavía falta conectar los servicios que necesita para poder probarla."}
        </p>
      </div>

      <ul className="flex flex-col gap-2" aria-label="Qué está listo">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-3 rounded-xl border border-rule bg-paper px-4 py-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${it.ok ? "bg-stroke text-stroke-ink" : it.ok === false ? "border border-alert text-alert" : "border border-rule"}`}
            >
              {it.ok ? <Check /> : it.ok === false ? "!" : ""}
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold text-ink">
                {it.label}
                <span className="sr-only">{it.ok ? " (listo)" : it.ok === false ? " (pendiente)" : ""}</span>
              </span>
              {it.detail ? <span className="text-sm text-graphite">{it.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {isAdmin && aiAvailable && toolReady && neededConnections.includes("email") ? <InboxResult workspaceId={workspaceId} base={base} /> : null}

      {toolCheck?.ok === false ? <p className="text-sm text-alert" role="alert">{toolCheck.error}</p> : null}
      {error && <p className="text-sm text-alert">{error}</p>}

      {!loading ? (
        <div className="flex flex-col gap-3">
          {verificationError ? (
            <button type="button" onClick={() => {
              setAi(null)
              setTrialRun(null)
              setToolCheck(neededConnections.length === 0 ? { ok: true, statuses: {} } : null)
              setCheckVersion((version) => version + 1)
            }} className={primary}>
              Volver a comprobar conexiones →
            </button>
          ) : ready && plan ? (
            <button type="button" onClick={saveAndOpen} disabled={saving} className={primary}>
              {saving ? "Guardando…" : "Abrir y probar esta automatización →"}
            </button>
          ) : isAdmin && ai?.ok === false ? (
            <button type="button" onClick={onConnectAi} className={primary}>
              Conectar mi IA para ejecutarla →
            </button>
          ) : isAdmin && toolCheck?.ok === true && neededConnections.some((connection) => toolCheck.statuses[connection] === false) ? (
            <button
              type="button"
              onClick={() => {
                const missing = neededConnections.find((connection) => toolCheck?.ok === true && toolCheck.statuses[connection] === false)
                if (missing) onConnectTool(missing)
              }}
              className={primary}
            >
              Conectar la siguiente herramienta →
            </button>
          ) : flowId ? (
            <Link href={`${base}/automatizaciones/${flowId}`} className={primary}>
              Ver el borrador de la automatización →
            </Link>
          ) : (
            <Link href={base} className={primary}>
              Ir a Hoy →
            </Link>
          )}
          {ai?.ok ? (
            <Link href={chatLink} className={secondary}>
              Seguir con esta automatización en el chat
            </Link>
          ) : null}
          <Link href={base} className="text-sm font-semibold text-link underline underline-offset-4 text-center">
            Ir a Hoy
          </Link>
        </div>
      ) : null}

      <p className="text-xs text-graphite">
        ¿Quieres probar con otra tarea?{" "}
        <button type="button" onClick={onRestart} className="font-semibold text-link underline underline-offset-4">
          Empezar de nuevo
        </button>
      </p>
    </section>
  )
}

// Paso 5: lo que MarchaSolo ya ha hecho con tu bandeja. Se actualiza solo
// mientras llegan y se ordenan los correos (como mucho 3 minutos).
function InboxResult({ workspaceId, base }: { workspaceId: string; base: string }) {
  const [result, setResult] = useState<OnboardingResult | null | undefined>(undefined)

  useEffect(() => {
    let stop = false
    const started = Date.now()
    let timer: number | undefined
    const tick = async () => {
      const r = await getOnboardingResult(workspaceId).catch(() => null)
      if (stop) return
      setResult(r)
      const settling = r !== null && (r.total === 0 || ((r.ownAi || r.trialAi) && r.classified < r.total))
      if (settling && Date.now() - started < 180_000) timer = window.setTimeout(tick, 10_000)
    }
    void tick()
    return () => {
      stop = true
      if (timer) window.clearTimeout(timer)
    }
  }, [workspaceId])

  if (!result) return null

  const box = "rounded-2xl border border-stroke bg-paper p-5 flex flex-col gap-3"
  const pulse = <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-stroke" />

  if (result.total === 0) {
    return (
      <div className={box} role="status">
        <p className="app-eyebrow">TU BANDEJA</p>
        <p className="flex items-center gap-2 text-ink">{pulse} Estoy trayendo tus correos. En unos minutos los tendrás ordenados.</p>
      </div>
    )
  }

  if (!result.ownAi && !result.trialAi) {
    return (
      <div className={box}>
        <p className="app-eyebrow">TU BANDEJA</p>
        <p className="text-ink">
          Ya he traído <strong>{result.total}</strong> conversaciones a tu bandeja. Conecta tu IA y las ordenaré por urgencia y te dejaré las
          respuestas preparadas.
        </p>
        <Link href={`${base}/integraciones#llms`} className="text-sm font-semibold text-link underline underline-offset-4">
          Conectar mi IA →
        </Link>
      </div>
    )
  }

  if (result.classified === 0) {
    return (
      <div className={box} role="status">
        <p className="app-eyebrow">TU BANDEJA</p>
        <p className="flex items-center gap-2 text-ink">
          {pulse} Ordenando tus {result.total} conversaciones…
        </p>
      </div>
    )
  }

  const stats = [
    { n: result.awaiting, label: result.awaiting === 1 ? "espera tu respuesta" : "esperan tu respuesta" },
    { n: result.urgent, label: result.urgent === 1 ? "es urgente" : "son urgentes" },
    { n: result.drafts, label: result.drafts === 1 ? "respuesta preparada" : "respuestas preparadas" },
    { n: result.noise, label: "boletines y avisos apartados" },
  ].filter((st, i) => i === 0 || st.n > 0) // un 0 no impresiona: solo se queda «esperan tu respuesta»
  return (
    <div className={box}>
      <p className="app-eyebrow">YA ESTOY TRABAJANDO PARA TI</p>
      <p className="rotulo text-lg text-ink">He ordenado tu bandeja</p>
      <ul className="flex flex-wrap gap-2">
        {stats.map((st) => (
          <li key={st.label} className="min-w-[8rem] flex-1 rounded-xl bg-sheet px-3 py-2">
            <span className="rotulo block text-2xl text-ink">{st.n}</span>
            <span className="text-xs text-graphite">{st.label}</span>
          </li>
        ))}
      </ul>
      {result.classified < result.total ? (
        <p className="flex items-center gap-2 text-xs text-graphite" role="status">
          {pulse} Sigo ordenando: {result.classified} de {result.total}.
        </p>
      ) : null}
      <Link href={`${base}/bandeja`} className="text-sm font-semibold text-link underline underline-offset-4">
        Ver lo de hoy en la bandeja →
      </Link>
    </div>
  )
}
