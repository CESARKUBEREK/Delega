"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react"
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
import { checkOnboardingConnection, completeOnboarding, generateOnboardingPlan, getOnboardingResult, type OnboardingResult } from "./actions"

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

// Ejemplos de los tres sectores (inmobiliarias, clínicas, profesionales).
// Cada uno cae en su plan sin IA (src/lib/onboarding-plans.ts).
const SUGGESTIONS = [
  "Responder las consultas de mis clientes",
  "Recordar sus citas a mis clientes el día antes",
  "Contestar a los interesados en una propiedad",
  "Avisar a los clientes con pagos pendientes",
  "Pasar los pedidos que llegan por correo a una planilla",
  "Preparar un informe de ventas cada viernes",
]

// Mientras el asistente prepara el plan (puede tardar unos segundos).
const LOADING_MESSAGES = ["Leyendo tu tarea…", "Eligiendo las herramientas que hacen falta…", "Ordenando los pasos…", "Casi listo…"]

function PlanLoading() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => Math.min(n + 1, LOADING_MESSAGES.length - 1)), 3500)
    return () => window.clearInterval(id)
  }, [])
  return (
    <p className="flex items-center gap-2 text-sm text-graphite" role="status" aria-live="polite">
      <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-stroke" />
      {LOADING_MESSAGES[i]}
    </p>
  )
}


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
    setError(null)
    setSupervisedAccepted(true)
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
          {userName ? `Hola ${userName}, ¡pongamos a rodar MarchaSolo!` : "¡Pongamos a rodar MarchaSolo!"}
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
      </div>

      {/* Introducción: qué es MarchaSolo, antes del paso 1 */}
      {step === "task" && <Intro />}

      {/* PASO 1 */}
      {step === "task" && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 1 de 5</p>
            <h2 className="rotulo text-xl mt-1">¿Qué tarea te quita más tiempo?</h2>
            <p className="text-graphite mt-1">
              Cuéntamela con tus palabras, como se la explicarías a alguien de tu equipo, o elige un ejemplo. No hace falta conectar nada
              todavía.
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
              placeholder="Ej.: cuando un cliente pide presupuesto por correo, prepárame la respuesta con nuestras tarifas para que la revise."
              className="w-full rounded-xl border border-rule bg-paper px-4 py-3 text-ink placeholder:text-graphite focus:border-stroke focus:outline-none"
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
              {pending ? "Preparando el plan…" : "Ver cómo lo haría →"}
            </button>
            {pending ? <PlanLoading /> : null}
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
          error={error}
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

          {isAdmin ? <InboxResult workspaceId={workspaceId} base={base} /> : null}

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
  error,
  onBack,
  onContinue,
  pending,
}: {
  plan: FlowPlan | null
  error: string | null
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

      {error && <p className="text-sm text-alert">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Perfecto, continuar →"}
        </button>
        <button type="button" onClick={onBack} className="inline-flex h-11 items-center rounded-xl border border-ink px-5 font-medium text-ink">
          ← Volver
        </button>
      </div>
    </section>
  )
}

// Introducción antes de la primera tarea: qué hace MarchaSolo por el negocio
// (solo cosas que ya hace hoy) y cuánto tiempo devuelve.
const INTRO_AREAS = [
  { title: "Atención al cliente", text: "Ordena tus correos y mensajes por urgencia y te deja las respuestas redactadas." },
  { title: "Reservas y citas", text: "Su asistente de voz atiende por teléfono y en tu web, y agenda las citas en tu calendario." },
  { title: "Gestión de clientes", text: "Reconoce a cada cliente y tiene a mano su ficha y sus conversaciones anteriores." },
  { title: "Planillas y documentos", text: "Pasa los datos de correos y pedidos a tus planillas y completa tus documentos." },
  { title: "Redes sociales", text: "Redacta tus publicaciones y las deja programadas." },
  { title: "Tu día, resumido", text: "Cada mañana: lo urgente, tu agenda y lo que espera respuesta." },
]

function Intro() {
  // En el móvil, el detalle va plegado para que la tarea quede a la vista.
  const [open, setOpen] = useState(false)
  return (
    <section aria-labelledby="intro-title" className="rounded-2xl border border-rule bg-sheet p-5 flex flex-col gap-4">
      <div>
        <p className="app-eyebrow">TU NEGOCIO, EN AUTOMÁTICO</p>
        <h2 id="intro-title" className="rotulo text-xl mt-1">
          Menos rutina, más negocio
        </h2>
        <p className="mt-1 text-graphite">
          MarchaSolo es el asistente que se ocupa del trabajo repetitivo de tu negocio, cada día y a cualquier hora. Tú te dedicas a vender y a
          cuidar a tus clientes; él prepara todo lo demás.
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="intro-detail"
          className="mt-3 text-sm font-semibold text-link underline underline-offset-4 sm:hidden"
        >
          {open ? "Ver menos" : "Ver qué puede hacer por ti"}
        </button>
      </div>

      <div id="intro-detail" className={`${open ? "flex" : "hidden"} flex-col gap-4 sm:flex`}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INTRO_AREAS.map((a) => (
            <li key={a.title} className="flex gap-3 rounded-xl border border-rule bg-paper p-3">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stroke" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{a.title}</span>
                <span className="text-sm text-graphite">{a.text}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="text-sm text-graphite">
          <strong className="text-ink">Así de fácil:</strong> le cuentas la tarea con tus palabras, él hace el trabajo pesado y tú apruebas en un
          toque. Nada se envía ni se cambia sin tu permiso.
        </p>
        <p className="rounded-xl bg-paper px-4 py-3 text-sm text-ink">
          <strong>Más productividad desde el primer día.</strong> Lo que hoy te lleva horas cada semana (responder las mismas consultas, confirmar
          citas, pasar datos, preparar informes) pasa a ser una revisión de minutos. Ese tiempo vuelve a ti, a tus clientes y a tu negocio.
        </p>
      </div>
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
      const settling = r !== null && (r.total === 0 || (r.ownAi && r.classified < r.total))
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

  if (!result.ownAi) {
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
