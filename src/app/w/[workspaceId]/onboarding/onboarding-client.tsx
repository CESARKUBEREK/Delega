"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react"
import { PlanView } from "@/components/plan-view"
import {
  chatHref,
  clearOnboarding,
  CONNECTION_ANCHOR,
  CONNECTION_LABEL,
  loadOnboarding,
  primaryConnection,
  saveOnboarding,
  supervisedPreview,
  type OnboardingConnection,
  type OnboardingSource,
  type OnboardingStep,
} from "@/lib/onboarding"
import type { FlowPlan } from "@/lib/plan"
import { checkOnboardingConnection, completeOnboarding, generateOnboardingPlan } from "./actions"

type Step = OnboardingStep

const ONBOARDING_STEPS: { id: Step; short: string }[] = [
  { id: "task", short: "Tarea" },
  { id: "plan", short: "Plan" },
  { id: "connect", short: "Conectar" },
  { id: "supervised", short: "Supervisar" },
  { id: "done", short: "Listo" },
]
const STEP_ORDER = ONBOARDING_STEPS.map((s) => s.id)

const Check = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

const SUGGESTIONS = [
  "Clasificar y responder correos de clientes",
  "Actualizar una planilla cuando llegue un pedido",
  "Preparar un resumen semanal de ventas",
  "Crear eventos en el calendario desde mensajes",
  "Preparar borradores de respuesta a presupuestos",
]


type OnboardingProps = {
  workspaceId: string
  workspaceName: string
  isAdmin: boolean
  userName: string
}

const noopSubscribe = () => () => {}

// El progreso se guarda en sessionStorage, que solo existe en el navegador:
// el flujo se pinta solo en el cliente y arranca con lo guardado.
export function OnboardingClient(props: OnboardingProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!mounted) {
    return <div className="h-64 rounded-2xl border border-rule bg-sheet" aria-busy="true" />
  }
  return <OnboardingFlow {...props} />
}

function OnboardingFlow({ workspaceId, workspaceName, isAdmin, userName }: OnboardingProps) {
  const base = `/w/${workspaceId}`
  // Lo guardado al ir a Integraciones (o a Google) y volver.
  const [saved] = useState(() => loadOnboarding(workspaceId))
  const [step, setStep] = useState<Step>(saved?.step ?? "task")
  const [task, setTask] = useState(saved?.task ?? "")
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(saved?.reply ?? null)
  const [plan, setPlan] = useState<FlowPlan | null>(saved?.plan ?? null)
  const [source, setSource] = useState<OnboardingSource | null>(saved?.source ?? null)
  const [conversationId, setConversationId] = useState<string | null>(saved?.conversationId ?? null)
  const [supervisedAccepted, setSupervisedAccepted] = useState(saved?.supervisedAccepted ?? false)
  const [pending, startTransition] = useTransition()

  // Si quedó la cookie de /bienvenida, Google devolvería allí y no aquí.
  useEffect(() => {
    document.cookie = "ms_setup=; path=/; max-age=0; samesite=lax"
  }, [])

  // Guardar en cada cambio. Al terminar (o sin nada que guardar) se borra.
  useEffect(() => {
    if (step === "done" || (step === "task" && !task.trim())) {
      clearOnboarding(workspaceId)
      return
    }
    saveOnboarding(workspaceId, { step, task, reply, plan, source, conversationId, supervisedAccepted })
  }, [workspaceId, step, task, reply, plan, source, conversationId, supervisedAccepted])

  const needed = plan ? primaryConnection(plan) : "none"

  const currentIndex = STEP_ORDER.indexOf(step)
  const progress = useMemo(() => ((currentIndex + 1) / STEP_ORDER.length) * 100, [currentIndex])

  // Los pasos ya hechos se pueden volver a abrir; hacia delante, no.
  const canGoTo = (target: Step) => {
    const i = STEP_ORDER.indexOf(target)
    if (i < 0 || i >= currentIndex) return false
    if (target !== "task" && !plan) return false
    if (target === "connect" && needed === "none") return false
    return true
  }
  const goToStep = (target: Step) => {
    if (!canGoTo(target)) return
    setError(null)
    setStep(target)
  }

  const validateTask = useCallback(() => {
    const value = task.trim()
    if (value.length < 12) {
      setError("Describe la tarea con un poco más de detalle (mínimo 12 caracteres).")
      return false
    }
    if (value.length > 500) {
      setError("Máximo 500 caracteres.")
      return false
    }
    setError(null)
    return true
  }, [task])

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateTask() || pending) return

    startTransition(async () => {
      const result = await generateOnboardingPlan({ workspaceId, message: task })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setReply(result.reply)
      setPlan(result.plan)
      setSource(result.source)
      setConversationId(result.conversationId)
      setStep("plan")
    })
  }

  const acceptPlan = () => {
    if (!plan) return
    if (needed === "none") {
      setStep("supervised")
    } else {
      setStep("connect")
    }
  }

  const goToSupervised = () => setStep("supervised")

  const finish = () => {
    if (!supervisedAccepted) {
      setError("Debes confirmar que entiendes que las acciones se ejecutarán con tu supervisión.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await completeOnboarding(workspaceId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setStep("done") // el efecto de guardado borra el progreso de la pestaña
    })
  }

  // Volver a empezar desde el paso 1 (sin salir de la página).
  const restart = () => {
    setStep("task")
    setTask("")
    setReply(null)
    setPlan(null)
    setSource(null)
    setConversationId(null)
    setSupervisedAccepted(false)
    setError(null)
  }

  return (
    <div className="setup flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex flex-col gap-2">
        <p className="app-eyebrow">ONBOARDING · {workspaceName.toUpperCase()}</p>
        <h1 className="rotulo text-2xl">
          {userName ? `Hola ${userName}, ` : ""}vamos a poner MarchaSolo en marcha
        </h1>
        <nav aria-label="Pasos del onboarding" className="setup-steps">
          <ol className="onboarding-steps">
            {ONBOARDING_STEPS.map((s, i) => {
              const current = s.id === step
              // «Conectar» no hace falta si el plan no necesita ninguna conexión.
              const skipped = s.id === "connect" && needed === "none" && i < currentIndex
              const done = i < currentIndex
              const className = `setup-step-link ${done ? "is-done" : ""} ${current ? "is-current" : ""}`
              const content = (
                <>
                  <span className="setup-step-dot" aria-hidden="true">
                    {done ? <Check /> : i + 1}
                  </span>
                  <span className="setup-step-label">
                    {s.short}
                    <span className="sr-only">{current ? " (actual)" : skipped ? " (no hace falta)" : done ? " (hecho)" : ""}</span>
                  </span>
                </>
              )
              return (
                <li key={s.id}>
                  {canGoTo(s.id) ? (
                    <button type="button" onClick={() => goToStep(s.id)} className={className} title={`Volver a ${s.short}`}>
                      {content}
                    </button>
                  ) : (
                    <span className={className} aria-current={current ? "step" : undefined}>
                      {content}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        <div
          className="setup-progress"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Paso ${currentIndex + 1} de ${STEP_ORDER.length}`}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* PASO 1 */}
      {step === "task" && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 1 de 5</p>
            <h2 className="rotulo text-xl mt-1">¿Qué te gustaría automatizar?</h2>
            <p className="text-graphite mt-1">
              Cuéntame una tarea que repites a menudo. No hace falta conectar nada todavía.
            </p>
          </div>

          <form onSubmit={handleTaskSubmit} className="flex flex-col gap-4">
            <label htmlFor="task" className="sr-only">
              Describe la tarea
            </label>
            <textarea
              id="task"
              value={task}
              onChange={(e) => {
                setTask(e.target.value)
                if (error) setError(null)
              }}
              rows={4}
              maxLength={500}
              placeholder="Ej: Cuando llega un correo de presupuesto, clasificarlo y preparar una respuesta para que la revise…"
              className="w-full rounded-xl border border-rule bg-paper px-4 py-3 text-ink placeholder:text-graphite focus:border-stroke focus:outline-none"
              autoFocus
            />
            {error && <p className="text-sm text-alert">{error}</p>}

            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setTask(s)
                    setError(null)
                  }}
                  className="rounded-full border border-rule px-3 py-1.5 text-sm text-graphite hover:border-ink hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
            >
              {pending ? "Preparando el plan…" : "Ver cómo lo resolvería →"}
            </button>
          </form>
        </section>
      )}

      {/* PASO 2 — Plan real o local */}
      {step === "plan" && plan && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 2 de 5</p>
            <h2 className="rotulo text-xl mt-1">Así lo resolvería</h2>
            {reply && <p className="text-graphite mt-1 whitespace-pre-wrap">{reply}</p>}
            {source === "trial" && (
              <p className="mt-2 text-xs text-graphite">
                Plan preparado con los créditos de prueba de MarchaSolo. Para ejecutarlo, conecta tu propia IA.
              </p>
            )}
            {source === "local" && (
              <p className="mt-2 text-xs text-graphite">
                Propuesta generada sin IA conectada. Cuando conectes una clave, los planes serán más precisos.
              </p>
            )}
          </div>

          <PlanView plan={plan} />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={acceptPlan}
              className="inline-flex h-11 items-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink"
            >
              Me gusta, continuar →
            </button>
            <button
              onClick={() => {
                setStep("task")
                setPlan(null)
                setReply(null)
                setSource(null)
                setConversationId(null)
              }}
              className="inline-flex h-11 items-center rounded-xl border border-ink px-5 font-medium text-ink"
            >
              Cambiar la tarea
            </button>
          </div>
        </section>
      )}

      {/* PASO 3 — Solo la conexión necesaria */}
      {step === "connect" && plan && (
        <ConnectStep
          workspaceId={workspaceId}
          base={base}
          needed={needed}
          label={CONNECTION_LABEL[needed]}
          onBack={() => setStep("plan")}
          onContinue={goToSupervised}
        />
      )}

      {/* PASO 4 — Supervisado, con el plan real */}
      {step === "supervised" && (
        <SupervisedStep
          plan={plan}
          accepted={supervisedAccepted}
          error={error}
          onAcceptChange={(v) => {
            setSupervisedAccepted(v)
            if (error) setError(null)
          }}
          onBack={() => setStep(needed === "none" ? "plan" : "connect")}
          onContinue={finish}
          pending={pending}
        />
      )}

      {/* PASO 5 — Listo */}
      {step === "done" && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 5 de 5</p>
            <h2 className="rotulo text-xl mt-1">Listo</h2>
            <p className="text-graphite mt-1">
              Tu plan te espera en el chat: desde allí puedes afinarlo, ejecutarlo o guardarlo como automatización.
            </p>
          </div>

          {plan ? (
            <div className="rounded-2xl border border-rule bg-paper p-5 flex flex-col gap-1">
              <p className="app-eyebrow">TU PLAN</p>
              <p className="font-semibold text-ink">{plan.name}</p>
              {plan.summary ? <p className="text-sm text-graphite">{plan.summary}</p> : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <Link
              href={chatHref(base, conversationId, task)}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink"
            >
              Seguir con este plan en el chat
            </Link>
            <Link
              href={base}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-ink px-5 font-medium text-ink"
            >
              Ir a Hoy
            </Link>
            {isAdmin && (
              <Link
                href={`${base}/integraciones`}
                className="text-sm font-semibold text-link underline underline-offset-4 text-center"
              >
                Configurar más conexiones
              </Link>
            )}
          </div>

          <p className="text-xs text-graphite">
            ¿Quieres probar con otra tarea?{" "}
            <button type="button" onClick={restart} className="font-semibold text-link underline underline-offset-4">
              Empezar de nuevo
            </button>
          </p>
        </section>
      )}
    </div>
  )
}

// Paso 3: comprueba si ya está conectado lo que hace falta y, si no, lleva a
// Integraciones. Vuelve a comprobar al regresar a esta pestaña.
function ConnectStep({
  workspaceId,
  base,
  needed,
  label,
  onBack,
  onContinue,
}: {
  workspaceId: string
  base: string
  needed: OnboardingConnection
  label: string
  onBack: () => void
  onContinue: () => void
}) {
  const [status, setStatus] = useState<"loading" | "connected" | "missing">("loading")
  const [error, setError] = useState<string | null>(null)
  const [checking, startCheck] = useTransition()

  const refresh = useCallback(() => {
    startCheck(async () => {
      const result = await checkOnboardingConnection({ workspaceId, connection: needed })
      if (!result.ok) {
        setError(result.error)
        setStatus("missing")
        return
      }
      setError(null)
      setStatus(result.connected ? "connected" : "missing")
    })
  }, [workspaceId, needed])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Al volver de otra pestaña (Integraciones), re-comprobar
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">Paso 3 de 5</p>
        <h2 className="rotulo text-xl mt-1">Solo necesito una cosa</h2>
        <p className="text-graphite mt-1">
          Para ejecutar este plan necesito acceso a <strong>{label}</strong>.
          No te pediré el resto de aplicaciones ahora.
        </p>
      </div>

      {status === "loading" || checking ? (
        <p className="text-sm text-graphite" role="status">
          Comprobando conexión…
        </p>
      ) : status === "connected" ? (
        <div className="rounded-2xl border border-ok bg-paper p-5 flex flex-col gap-3">
          <p className="font-medium text-ink">✓ {label} ya está conectado</p>
          <p className="text-sm text-graphite">Puedes seguir con la primera ejecución supervisada.</p>
          <button
            onClick={onContinue}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink"
          >
            Continuar →
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-rule bg-paper p-5 flex flex-col gap-3">
          <p className="text-sm text-graphite">
            • Tus credenciales se cifran y se guardan en Vault.
            <br />
            • MarchaSolo nunca envía ni escribe nada sin tu aprobación.
            <br />
            • Puedes desconectar esta aplicación en cualquier momento.
          </p>
          <Link
            href={`${base}/integraciones#${CONNECTION_ANCHOR[needed]}`}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink"
          >
            Conectar {label} →
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="text-sm font-semibold text-link underline underline-offset-4"
          >
            Ya lo conecté, comprobar de nuevo
          </button>
          {error && <p className="text-sm text-alert">{error}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={onContinue} className="text-sm font-semibold text-link underline underline-offset-4">
          Continuar sin conectar (modo demo)
        </button>
        <button onClick={onBack} className="text-sm text-graphite">
          ← Volver al plan
        </button>
      </div>
    </section>
  )
}

// Paso 4: qué hará MarchaSolo con este plan y qué no hará sin permiso.
function SupervisedStep({
  plan,
  accepted,
  error,
  onAcceptChange,
  onBack,
  onContinue,
  pending,
}: {
  plan: FlowPlan | null
  accepted: boolean
  error: string | null
  onAcceptChange: (v: boolean) => void
  onBack: () => void
  onContinue: () => void
  pending: boolean
}) {
  const preview = supervisedPreview(plan)

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">Paso 4 de 5</p>
        <h2 className="rotulo text-xl mt-1">Tú apruebas cada acción</h2>
        <p className="text-graphite mt-1">
          MarchaSolo lee y prepara solo. Antes de escribir o enviar algo, te enseña exactamente qué va a hacer y espera tu aprobación. Siempre, no solo al principio.
        </p>
      </div>

      <div className="rounded-2xl border border-stroke bg-paper p-5 flex flex-col gap-3">
        <p className="font-medium text-ink">Con este plan, te dirá:</p>
        <blockquote className="border-l-2 border-stroke pl-4 text-sm text-graphite">
          <p>«{preview.will}</p>
          <p className="mt-1">
            <strong>{preview.wont}</strong>»
          </p>
        </blockquote>

        {preview.approvals.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-ink">Pasos que esperarán tu aprobación</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-graphite">
              {preview.approvals.map((a) => (
                <li key={a.id}>{a.title}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-graphite">Este plan no escribe ni envía nada: solo tendrás que revisar el resultado.</p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-rule"
        />
        <span className="text-sm text-ink">
          Entiendo que las acciones que modifican datos o envían mensajes requerirán mi aprobación explícita.
        </span>
      </label>
      {error && <p className="text-sm text-alert">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Entendido, continuar →"}
        </button>
        <button type="button" onClick={onBack} className="inline-flex h-11 items-center rounded-xl border border-ink px-5 font-medium text-ink">
          ← Volver
        </button>
      </div>
    </section>
  )
}
