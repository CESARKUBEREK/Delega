"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react"
import { PlanView } from "@/components/plan-view"
import {
  chatHref,
  clearOnboarding,
  CONNECTION_ANCHOR,
  CONNECTION_LABEL,
  loadOnboarding,
  requiredConnections,
  saveOnboarding,
  supervisedPreview,
  type OnboardingConnection,
  type OnboardingSource,
  type OnboardingStep,
} from "@/lib/onboarding"
import type { FlowPlan } from "@/lib/plan"
import type { WebsiteSnapshot } from "@/lib/business-discovery/website-parser"
import { BUSINESS_PROFILE_FIELDS, type BusinessProfile } from "@/lib/business-discovery/business-profile"
import { saveFlowPlan } from "../flow-editor-actions"
import {
  analyzeOnboardingWebsite,
  checkOnboardingAi,
  checkOnboardingConnection,
  checkOnboardingConnections,
  completeOnboarding,
  generateOnboardingPlan,
  getOnboardingResult,
  trackOnboardingStep,
  type OnboardingResult,
} from "./actions"

type Step = OnboardingStep

const ONBOARDING_STEPS: { id: Step; short: string }[] = [
  { id: "task", short: "Tarea" },
  { id: "plan", short: "Plan" },
  { id: "ai", short: "Tu IA" },
  { id: "connect", short: "Conectar" },
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
  "Cuando un cliente escriba por WhatsApp, prepárame la respuesta con mis tarifas",
  "Cuando pidan una visita o una cita, ofrece dos huecos de mi agenda",
  "Cuando entre un lead, regístralo en el CRM y prepárame la primera respuesta",
  "Cada mañana, ordena la bandeja y déjame las respuestas urgentes preparadas",
  "Cuando entre una incidencia, clasifícala y déjame la primera respuesta",
  "Después de cada visita, prepárame el mensaje de seguimiento",
]

const CONTACT_CHANNELS = [
  ["email", "Correo"],
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram / redes"],
  ["website", "Web / formularios"],
  ["phone", "Teléfono"],
  ["in_person", "En persona"],
] as const

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
  // Tarjetas de conexión de Integraciones (componentes de servidor), para
  // conectar sin salir del onboarding: las IAs en el paso 3 y la herramienta
  // del plan en el paso 4.
  cards: Partial<Record<Exclude<OnboardingConnection, "none">, ReactNode>>
  aiCards: { recommended: ReactNode; others: ReactNode }
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

function OnboardingFlow({ workspaceId, workspaceName, isAdmin, userName, cards, aiCards }: OnboardingProps) {
  const base = `/w/${workspaceId}`
  // Lo guardado al ir a Integraciones (o a Google) y volver.
  const [saved] = useState(() => loadOnboarding(workspaceId))
  const [step, setStep] = useState<Step>(saved?.step ?? "task")
  const [task, setTask] = useState(saved?.task ?? "")
  const [businessType, setBusinessType] = useState("")
  const [mainPain, setMainPain] = useState("")
  const [channels, setChannels] = useState<string[]>([])
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [websiteSnapshot, setWebsiteSnapshot] = useState<WebsiteSnapshot | null>(null)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  const [profileConfirmed, setProfileConfirmed] = useState(false)
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [websitePending, setWebsitePending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reply, setReply] = useState<string | null>(saved?.reply ?? null)
  const [plan, setPlan] = useState<FlowPlan | null>(saved?.plan ?? null)
  const [source, setSource] = useState<OnboardingSource | null>(saved?.source ?? null)
  const [conversationId, setConversationId] = useState<string | null>(saved?.conversationId ?? null)
  const [trialRemaining, setTrialRemaining] = useState<number | null>(saved?.trialRemaining ?? null)
  const [flowId, setFlowId] = useState<string | null>(saved?.flowId ?? null)
  const [pending, startTransition] = useTransition()

  // Borra una cookie de vuelta antigua; el paso 4 la vuelve a poner si hace falta.
  useEffect(() => {
    document.cookie = "ms_setup=; path=/; max-age=0; samesite=lax"
  }, [])

  // Guardar en cada cambio. Al terminar (o sin nada que guardar) se borra.
  useEffect(() => {
    if (step === "done" || (step === "task" && !task.trim())) {
      clearOnboarding(workspaceId)
      return
    }
    saveOnboarding(workspaceId, { step, task, reply, plan, source, conversationId, trialRemaining, flowId })
  }, [workspaceId, step, task, reply, plan, source, conversationId, trialRemaining, flowId])

  const requirements = useMemo(() => (plan ? requiredConnections(plan) : []), [plan])
  const [connectionIndex, setConnectionIndex] = useState(0)
  const needed = requirements[connectionIndex] ?? requirements[0] ?? "none"

  // Embudo: la primera llegada a cada paso (la base ignora las repeticiones).
  const planName = plan?.name
  useEffect(() => {
    void trackOnboardingStep(workspaceId, step, { source: source ?? undefined, plan: planName, needed })
  }, [workspaceId, step, source, planName, needed])

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

  const handleWebsiteAnalysis = async () => {
    if (!websiteUrl.trim() || pending || websitePending) return
    setWebsiteError(null)
    setWebsiteSnapshot(null)
    setBusinessProfile(null)
    setProfileConfirmed(false)
    setWebsitePending(true)
    try {
      const result = await analyzeOnboardingWebsite({ workspaceId, url: websiteUrl })
      if (!result.ok) setWebsiteError(result.error)
      else {
        setWebsiteSnapshot(result.snapshot)
        setBusinessProfile(result.profile)
      }
    } catch {
      setWebsiteError("No se pudo analizar la web. Puedes continuar sin ella.")
    } finally {
      setWebsitePending(false)
    }
  }

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (websiteSnapshot && !profileConfirmed) {
      setError("Revisa y confirma el perfil de tu negocio antes de preparar la propuesta.")
      return
    }
    if (!validateTask() || pending) return

    startTransition(async () => {
      const websiteContext = websiteSnapshot && businessProfile && profileConfirmed
        ? BUSINESS_PROFILE_FIELDS.map(({ key, label }) => {
            const value = businessProfile[key].value.trim()
            return value ? `${label}: ${value}` : ""
          }).filter(Boolean).join("\\n").slice(0, 3_000)
        : undefined
      const result = await generateOnboardingPlan({
        workspaceId,
        message: task,
        websiteContext,
        businessIntake: { businessType, mainPain, channels },
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setReply(result.reply)
      setPlan(result.plan)
      setSource(result.source)
      setConversationId(result.conversationId)
      setTrialRemaining(result.trialRemaining)
      setStep("plan")
    })
  }

  // El plan solo avanza cuando existe un borrador persistido.
  const persistPlan = async (): Promise<string | null> => {
    if (!plan) {
      setError("No hay un plan que guardar. Vuelve a describir la tarea.")
      return null
    }
    if (flowId) return flowId
    try {
      const savedPlan = await saveFlowPlan({ workspaceId, flowId: null, plan, fileIds: [] })
      if (!savedPlan.ok) {
        setError(savedPlan.error || "No se pudo guardar el plan. Inténtalo de nuevo.")
        return null
      }
      setFlowId(savedPlan.flowId)
      return savedPlan.flowId
    } catch {
      setError("No se pudo guardar el plan. Comprueba tu conexión e inténtalo de nuevo.")
      return null
    }
  }

  // Plan aceptado → persistirlo una sola vez antes de continuar.
  const acceptPlan = () => {
    if (!plan || pending) return
    setError(null)
    startTransition(async () => {
      const savedFlowId = await persistPlan()
      if (!savedFlowId) return
      setStep("ai")
    })
  }

  // Después de la IA, la herramienta que pide el plan (si pide alguna).
  const afterAi = () => {
    if (requirements.length === 0) finish()
    else {
      setConnectionIndex(0)
      setStep("connect")
    }
  }

  // Al llegar a «Listo» se marca el onboarding como terminado.
  const finish = () => {
    setError(null)
    startTransition(async () => {
      const savedFlowId = await persistPlan()
      if (!savedFlowId) return
      try {
        const result = await completeOnboarding(workspaceId)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setStep("done") // el efecto de guardado borra el progreso de la pestaña
      } catch {
        setError("No se pudo finalizar el onboarding. Inténtalo de nuevo.")
      }
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
    setFlowId(null)
    setError(null)
  }

  // Pasos visibles (si el plan no pide herramienta, «Conectar» no cuenta).
  const visibleSteps = ONBOARDING_STEPS.filter((s) => !(s.id === "connect" && requirements.length === 0))
  const stepOrdinal = (id: Step) => {
    const i = visibleSteps.findIndex((s) => s.id === id)
    return i >= 0 ? i + 1 : 1
  }
  const stepTotal = visibleSteps.length

  return (
    <div className="setup flex flex-col gap-6 max-w-2xl mx-auto" data-step={step}>
      <div className="setup-header flex flex-col gap-2">
        <p className="app-eyebrow">ONBOARDING · {workspaceName.toUpperCase()}</p>
        <h1 className="rotulo text-2xl">
          {userName ? `Hola ${userName}, ¡pongamos a rodar MarchaSolo!` : "¡Pongamos a rodar MarchaSolo!"}
        </h1>
        <nav aria-label="Pasos del onboarding" className="setup-steps">
          <ol className="onboarding-steps">
            {visibleSteps.map((s, i) => {
              const current = s.id === step
              const visibleCurrentIndex = visibleSteps.findIndex((item) => item.id === step)
              const done = visibleCurrentIndex >= 0 && i < visibleCurrentIndex
              const className = `setup-step-link ${done ? "is-done" : ""} ${current ? "is-current" : ""}`
              const content = (
                <>
                  <span className="setup-step-dot" aria-hidden="true">
                    {done ? <Check /> : i + 1}
                  </span>
                  <span className="setup-step-label">
                    {s.short}
                    <span className="sr-only">{current ? " (actual)" : done ? " (hecho)" : ""}</span>
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
            <p className="text-sm font-semibold text-graphite">
              Paso {stepOrdinal("task")} de {stepTotal}
            </p>
            <h2 className="rotulo text-xl mt-1">¿Qué tarea te quita más tiempo?</h2>
            <p className="text-graphite mt-1">
              Cuéntamela con tus palabras, como se la explicarías a alguien de tu equipo, o elige un ejemplo. No hace falta conectar nada
              todavía.
            </p>
          </div>

          <form onSubmit={handleTaskSubmit} className="flex flex-col gap-4">
            <div className="rounded-xl border border-rule bg-paper p-4 flex flex-col gap-3">
              <div>
                <label htmlFor="website-url" className="block text-sm font-semibold text-ink">La web de mi negocio <span className="font-normal text-graphite">(opcional)</span></label>
                <p className="mt-1 text-sm text-graphite">Si tienes una web, la analizaré para entender mejor qué ofreces, a quién ayudas y cómo trabajas. No necesito acceso ni contraseña.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="website-url"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  value={websiteUrl}
                  onChange={(e) => { setWebsiteUrl(e.target.value); setWebsiteSnapshot(null); setBusinessProfile(null); setProfileConfirmed(false); setWebsiteError(null) }}
                  placeholder="https://www.tunegocio.com"
                  maxLength={2048}
                  className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2 text-ink placeholder:text-graphite focus:border-stroke focus:outline-none"
                />
                <button type="button" onClick={handleWebsiteAnalysis} disabled={!websiteUrl.trim() || pending || websitePending} className="inline-flex h-10 items-center justify-center rounded-xl border border-ink px-4 text-sm font-semibold text-ink disabled:opacity-50">
                  {websitePending ? "Analizando…" : "Analizar mi web"}
                </button>
              </div>
              {websiteError ? <p className="text-sm text-alert" role="alert">{websiteError}</p> : null}
              {websiteSnapshot && businessProfile ? (
                <div className="rounded-lg border border-rule bg-sheet p-4 flex flex-col gap-3" aria-live="polite">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Esto es lo que hemos entendido</p>
                    <p className="mt-1 font-semibold text-ink">{websiteSnapshot.title ?? websiteSnapshot.url}</p>
                    <p className="mt-1 text-xs text-graphite">{websiteSnapshot.pages.length > 1 ? `Hemos revisado ${websiteSnapshot.pages.length} páginas públicas del mismo dominio.` : "Hemos revisado una página pública."} Corrige lo que haga falta; los campos vacíos no se han podido verificar.</p>
                    <p className="mt-1 break-all text-xs text-graphite">Páginas consultadas: {websiteSnapshot.pages.map((page) => page.url).join(" · ")}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {BUSINESS_PROFILE_FIELDS.map(({ key, label, hint }) => (
                      <label key={key} className="flex flex-col gap-1 text-sm font-medium text-ink">
                        {label}
                        <span className="text-xs font-normal text-graphite">{hint}</span>
                        <textarea
                          rows={2}
                          value={businessProfile[key].value}
                          onChange={(event) => {
                            setBusinessProfile((current) => current ? {
                              ...current,
                              [key]: { ...current[key], value: event.target.value, confirmed: false },
                            } : current)
                            setProfileConfirmed(false)
                          }}
                          className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-stroke focus:outline-none"
                        />
                        {businessProfile[key].evidence.length ? (
                          <span className="text-xs font-normal text-graphite">Evidencia: {businessProfile[key].evidence[0]} <span className="block">Fuente: {businessProfile[key].evidenceSources[0]}</span></span>
                        ) : (
                          <span className="text-xs font-normal text-graphite">Sin información clara en la web</span>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => setProfileConfirmed(true)} className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-paper">
                      {profileConfirmed ? "Perfil confirmado" : "Confirmar perfil"}
                    </button>
                    {profileConfirmed ? <span className="text-xs text-graphite" role="status">Usaremos estos datos para adaptar tu propuesta.</span> : <span className="text-xs text-graphite">El perfil no se utilizará hasta que lo confirmes.</span>}
                    <button type="button" onClick={() => { setWebsiteSnapshot(null); setBusinessProfile(null); setProfileConfirmed(false) }} className="text-xs font-semibold text-link underline underline-offset-4">Quitar análisis</button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border border-rule bg-paper p-4 flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Cuéntame un poco de tu negocio <span className="font-normal text-graphite">(opcional)</span></p>
                <p className="mt-1 text-xs text-graphite">Con estos datos podré adaptar mejor el equipo digital y las herramientas que te proponga.</p>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                ¿A qué te dedicas?
                <select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink">
                  <option value="">Selecciona tu actividad</option>
                  <option value="professional">Servicios profesionales / consultoría</option>
                  <option value="agency">Agencia / estudio</option>
                  <option value="retail">Comercio / tienda</option>
                  <option value="real_estate">Inmobiliaria</option>
                  <option value="health">Salud / clínica</option>
                  <option value="hospitality">Hostelería / turismo</option>
                  <option value="industry">Industria / fabricación</option>
                  <option value="other">Otro tipo de negocio</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                ¿Qué te gustaría mejorar primero?
                <select value={mainPain} onChange={(event) => setMainPain(event.target.value)} className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink">
                  <option value="">Elige tu prioridad</option>
                  <option value="customer_messages">Responder consultas y mensajes</option>
                  <option value="appointments">Organizar citas y reservas</option>
                  <option value="sales_followup">Hacer seguimiento de clientes y ventas</option>
                  <option value="admin">Reducir tareas administrativas</option>
                  <option value="billing">Facturas y cobros</option>
                  <option value="reporting">Informes y control del negocio</option>
                  <option value="marketing">Contenido y redes sociales</option>
                  <option value="other">Otra tarea</option>
                </select>
              </label>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium text-ink">¿Por dónde te contactan tus clientes? <span className="font-normal text-graphite">(puedes elegir varios)</span></legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {CONTACT_CHANNELS.map(([value, label]) => (
                    <label key={value} className="inline-flex items-center gap-2 text-sm text-graphite">
                      <input
                        type="checkbox"
                        checked={channels.includes(value)}
                        onChange={(event) => setChannels((current) => event.target.checked
                          ? [...current, value]
                          : current.filter((channel) => channel !== value))}
                        className="h-4 w-4 accent-ink"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
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
            <p className="text-sm font-semibold text-graphite">
              Paso {stepOrdinal("plan")} de {stepTotal}
            </p>
            <h2 className="rotulo text-xl mt-1">Así lo resolvería</h2>
            {reply && <p className="text-graphite mt-1 whitespace-pre-wrap">{reply}</p>}
            {source === "trial" && (
              <p className="mt-2 text-xs text-graphite">
                Plan preparado con un modelo de IA avanzado, por cuenta de MarchaSolo
                {trialRemaining !== null
                  ? trialRemaining > 0
                    ? ` (te queda ${trialRemaining} ${trialRemaining === 1 ? "plan" : "planes"} de prueba)`
                    : " (era tu último plan de prueba)"
                  : ""}
                . Para ejecutarlo, en el paso siguiente conectas tu propia IA.
              </p>
            )}
            {source === "local" && (
              <p className="mt-2 text-xs text-graphite">
                Propuesta basada en patrones habituales, sin IA. Con tu IA conectada, los planes se adaptan a tu negocio.
              </p>
            )}
          </div>

          <PlanView plan={plan} animated />

          <SupervisedNote plan={plan} />
          <DemoApprovalCard plan={plan} />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={acceptPlan}
              disabled={pending}
              className="inline-flex h-11 items-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
            >
              {pending ? "Guardando el plan…" : "Me gusta, continuar →"}
            </button>
            <button
              onClick={() => {
                setStep("task")
                setPlan(null)
                setReply(null)
                setSource(null)
                setConversationId(null)
                setFlowId(null)
              }}
              className="inline-flex h-11 items-center rounded-xl border border-ink px-5 font-medium text-ink"
            >
              Cambiar la tarea
            </button>
          </div>
        </section>
      )}

      {/* PASO 3 — Tu IA: lo primero que se conecta */}
      {step === "ai" && plan && (
        <AiStep
          workspaceId={workspaceId}
          base={base}
          isAdmin={isAdmin}
          cards={aiCards}
          fromTrial={source === "trial"}
          error={error}
          pending={pending}
          lastStep={needed === "none"}
          stepLabel={`Paso ${stepOrdinal("ai")} de ${stepTotal}`}
          onBack={() => setStep("plan")}
          onContinue={afterAi}
          onFinishDraft={finish}
        />
      )}

      {/* PASO 4 — La herramienta que pide el plan */}
      {step === "connect" && plan && (
        <ConnectStep
          workspaceId={workspaceId}
          base={base}
          needed={needed}
          label={CONNECTION_LABEL[needed]}
          card={needed === "none" ? null : cards[needed]}
          error={error}
          pending={pending}
          stepLabel={`Paso ${stepOrdinal("connect")} de ${stepTotal}`}
          onBack={() => setStep("ai")}
          onContinue={finish}
        />
      )}

      {/* PASO 5 — Listo: lo hecho y la acción que toca ahora */}
      {step === "done" && (
        <DoneStep
          workspaceId={workspaceId}
          base={base}
          isAdmin={isAdmin}
          plan={plan}
          neededConnections={requirements}
          flowId={flowId}
          chatLink={chatHref(base, conversationId, task)}
          stepLabel={`Paso ${stepOrdinal("done")} de ${stepTotal}`}
          onConnectAi={() => setStep("ai")}
          onConnectTool={(connection) => {
            const index = requirements.indexOf(connection)
            setConnectionIndex(index >= 0 ? index : 0)
            setStep("connect")
          }}
          onRestart={restart}
        />
      )}
    </div>
  )
}

// Paso 4: comprueba si ya está conectado lo que hace falta y, si no, enseña
// aquí mismo la tarjeta de conexión (la misma que en Integraciones). Vuelve a
// comprobar sola cada pocos segundos, al volver a la pestaña y al volver de
// Google (la cookie ms_setup trae de vuelta a esta página).
function ConnectStep({
  workspaceId,
  base,
  needed,
  label,
  card,
  error: finishError,
  pending,
  stepLabel,
  onBack,
  onContinue,
}: {
  workspaceId: string
  base: string
  needed: OnboardingConnection
  label: string
  card: ReactNode
  error: string | null
  pending: boolean
  stepLabel: string
  onBack: () => void
  onContinue: () => void
}) {
  const [status, setStatus] = useState<"loading" | "connected" | "missing" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [checking, startCheck] = useTransition()
  const box = useRef<HTMLDivElement>(null)

  // Comprobación silenciosa: no cambia la pantalla salvo que ya esté conectado,
  // para no borrar lo que se esté escribiendo en la tarjeta.
  const check = useCallback(async () => {
    const result = await checkOnboardingConnection({ workspaceId, connection: needed }).catch(() => null)
    if (!result) {
      setError("No se pudo comprobar la conexión. Inténtalo de nuevo.")
      setStatus("error")
      return
    }
    if (!result.ok) {
      setError(result.error)
      setStatus("error")
      return
    }
    setError(null)
    setStatus(result.connected ? "connected" : "missing")
  }, [workspaceId, needed])

  useEffect(() => {
    const first = window.setTimeout(() => void check(), 0)
    const id = window.setInterval(() => void check(), 8000)
    const onFocus = () => void check()
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [check])

  // Si Google se abre desde aquí, que vuelva a esta página (30 minutos).
  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; secure" : ""
    document.cookie = `ms_setup=${encodeURIComponent(`${workspaceId}:onboarding`)}; path=/; max-age=1800; samesite=lax${secure}`
  }, [workspaceId])

  useEffect(() => {
    if (status === "connected") void trackOnboardingStep(workspaceId, "connected", { needed })
  }, [status, workspaceId, needed])

  // Las tarjetas de Integraciones vienen plegadas: abrir la primera.
  useEffect(() => {
    if (status !== "missing") return
    const first = box.current?.querySelector<HTMLDetailsElement>("details.integration-accordion")
    if (first && !first.open) first.open = true
  }, [status])

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">{stepLabel}</p>
        <h2 className="rotulo text-xl mt-1">Solo falta una cosa</h2>
        <p className="text-graphite mt-1">
          Para este plan necesito acceso a <strong>{label}</strong>. {card ? "Conéctalo aquí mismo; el resto puede esperar." : "Abre Integraciones para configurarlo; el resto puede esperar."}
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-graphite" role="status">
          Comprobando la conexión…
        </p>
      ) : status === "error" ? (
        <div className="flex flex-col gap-3" role="alert">
          <p className="text-sm text-alert">{error}</p>
          <button type="button" onClick={() => startCheck(check)} disabled={checking} className="text-sm font-semibold text-link underline underline-offset-4">
            {checking ? "Comprobando…" : "Volver a comprobar"}
          </button>
        </div>
      ) : status === "connected" ? (
        <div className="rounded-2xl border border-ok bg-paper p-5 flex flex-col gap-3" role="status">
          <p className="font-medium text-ink">✓ {label} está conectado</p>
          <button
            type="button"
            onClick={onContinue}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Terminar →"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div ref={box} className="setup-cards">
            {card}
          </div>
          <p className="text-xs text-graphite">
            Tus credenciales se guardan cifradas y puedes desconectar cuando quieras. MarchaSolo nunca envía ni escribe nada sin tu aprobación.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => startCheck(check)}
              disabled={checking}
              className="font-semibold text-link underline underline-offset-4 disabled:opacity-60"
            >
              {checking ? "Comprobando…" : "Ya lo conecté, comprobar"}
            </button>
            <Link href={`${base}/integraciones#${CONNECTION_ANCHOR[needed]}`} className="text-graphite underline underline-offset-4">
              Abrir en Integraciones
            </Link>
          </p>
          {error && <p className="text-sm text-alert">{error}</p>}
        </div>
      )}

      {finishError && <p className="text-sm text-alert">{finishError}</p>}

      <div className="flex flex-wrap gap-3">
        {status !== "connected" ? (
          <button type="button" onClick={onContinue} disabled={pending} className="text-sm font-semibold text-link underline underline-offset-4">
            Lo conecto más tarde
          </button>
        ) : null}
        <button type="button" onClick={onBack} className="text-sm text-graphite">
          ← Volver a tu IA
        </button>
      </div>
    </section>
  )
}

// Paso 2 (debajo del plan): qué hará MarchaSolo con él y qué no hará sin
// permiso. Antes era un paso entero; es información, no una decisión.
function SupervisedNote({ plan }: { plan: FlowPlan }) {
  const preview = supervisedPreview(plan)
  return (
    <div className="rounded-2xl border border-stroke bg-paper p-5 flex flex-col gap-3">
      <p className="font-medium text-ink">Tú apruebas cada acción</p>
      <blockquote className="border-l-2 border-stroke pl-4 text-sm text-graphite">
        <p>«{preview.will}</p>
        <p className="mt-1">
          <strong>{preview.wont}</strong>»
        </p>
      </blockquote>
      {preview.approvals.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-ink">Esperarán tu aprobación</p>
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
  )
}

// Demostración aislada: enseña el recorrido de una aprobación sin crear
// ejecuciones ni llamar a proveedores externos.
function DemoApprovalCard({ plan }: { plan: FlowPlan }) {
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending")
  const approval = plan.steps.find((step) => step.requires_approval)

  return (
    <section className="rounded-2xl border border-rule bg-sheet p-5 flex flex-col gap-4" aria-labelledby="demo-approval-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-graphite">EJEMPLO INTERACTIVO</p>
          <h3 id="demo-approval-title" className="mt-1 font-semibold text-ink">Así funciona una aprobación</h3>
        </div>
        <span className="rounded-full border border-rule px-2.5 py-1 text-xs font-semibold text-graphite">SIMULACIÓN</span>
      </div>

      <div className="rounded-xl border border-rule bg-paper p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs text-graphite">ACCIÓN QUE REVISARÍAS</p>
          <p className="mt-1 font-medium text-ink">{approval?.title ?? "Una propuesta de MarchaSolo"}</p>
        </div>
        <div className="border-t border-rule pt-3">
          <p className="text-xs text-graphite">VISTA PREVIA FICTICIA</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            MarchaSolo te mostrará aquí el contenido y los cambios concretos de «{plan.name}» antes de hacer nada.
          </p>
        </div>
      </div>

      <p className="text-xs text-graphite">
        Este ejemplo no utiliza tus aplicaciones ni envía, escribe o modifica datos.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {decision === "pending" ? (
          <>
            <button
              type="button"
              onClick={() => setDecision("approved")}
              className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-paper"
            >
              Simular aprobación
            </button>
            <button
              type="button"
              onClick={() => setDecision("rejected")}
              className="inline-flex h-10 items-center rounded-xl border border-rule px-4 text-sm font-medium text-ink"
            >
              Simular rechazo
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setDecision("pending")}
            className="inline-flex h-10 items-center rounded-xl border border-rule px-4 text-sm font-medium text-ink"
          >
            Repetir ejemplo
          </button>
        )}
        <p className="text-sm text-graphite" role="status" aria-live="polite">
          {decision === "approved"
            ? "Ejemplo aprobado. No se ha ejecutado ninguna acción externa."
            : decision === "rejected"
              ? "Ejemplo rechazado. No se ha ejecutado ninguna acción externa."
              : "Prueba qué ocurre al aprobar o rechazar."}
        </p>
      </div>
    </section>
  )
}

// Paso 3: la IA del cliente, lo primero que se conecta. Sin ella MarchaSolo no
// ejecuta nada (ni la bandeja ni las automatizaciones). Comprueba sola cada
// pocos segundos y al volver a la pestaña (la clave se saca en otra pestaña).
function AiStep({
  workspaceId,
  base,
  isAdmin,
  cards,
  fromTrial,
  error: finishError,
  pending,
  lastStep,
  stepLabel,
  onBack,
  onContinue,
  onFinishDraft,
}: {
  workspaceId: string
  base: string
  isAdmin: boolean
  cards: { recommended: ReactNode; others: ReactNode }
  fromTrial: boolean
  error: string | null
  pending: boolean
  lastStep: boolean
  stepLabel: string
  onBack: () => void
  onContinue: () => void
  onFinishDraft: () => void
}) {
  const [status, setStatus] = useState<"loading" | "connected" | "missing">("loading")
  const [label, setLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, startCheck] = useTransition()
  const recommendedBox = useRef<HTMLDivElement>(null)

  const check = useCallback(async () => {
    const result = await checkOnboardingAi(workspaceId).catch(() => null)
    // Si no se puede comprobar, se enseñan las tarjetas igualmente.
    if (!result) {
      setStatus((s) => (s === "loading" ? "missing" : s))
      return
    }
    if (!result.ok) {
      setError(result.error)
      setStatus((s) => (s === "loading" ? "missing" : s))
      return
    }
    setError(null)
    setLabel(result.label)
    setStatus((s) => (result.connected ? "connected" : s === "loading" ? "missing" : s))
  }, [workspaceId])

  useEffect(() => {
    const first = window.setTimeout(() => void check(), 0)
    const id = window.setInterval(() => void check(), 8000)
    const onFocus = () => void check()
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [check])

  useEffect(() => {
    if (status === "connected") void trackOnboardingStep(workspaceId, "ai_connected")
  }, [status, workspaceId])

  // La tarjeta recomendada, abierta: el botón a la web del proveedor a la vista.
  useEffect(() => {
    if (status !== "missing") return
    const card = recommendedBox.current?.querySelector<HTMLDetailsElement>("details.integration-accordion")
    if (card && !card.open) card.open = true
  }, [status])

  const next = lastStep ? (pending ? "Guardando…" : "Terminar →") : "Continuar →"

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">{stepLabel}</p>
        <h2 className="rotulo text-xl mt-1">Conecta tu IA</h2>
        <p className="text-graphite mt-1">
          Es el motor de MarchaSolo: con ella lee, ordena y redacta. Usas tu propia cuenta de IA: pagas allí, directamente al proveedor, solo
          lo que uses. Una automatización como la de tu plan suele costar unos céntimos por ejecución, y puedes fijar un presupuesto.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-graphite" role="status">
          Comprobando tu IA…
        </p>
      ) : status === "connected" ? (
        <div className="rounded-2xl border border-ok bg-paper p-5 flex flex-col gap-3" role="status">
          <p className="font-medium text-ink">✓ {label ? `${label} está conectada` : "Tu IA está conectada"}</p>
          <button
            type="button"
            onClick={onContinue}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
          >
            {next}
          </button>
        </div>
      ) : isAdmin ? (
        <div className="flex flex-col gap-3">
          <ol className="grid gap-2 text-sm text-graphite sm:grid-cols-3">
            <li className="rounded-xl border border-rule bg-paper p-3">
              <strong className="block text-ink">1. Abre la web del proveedor</strong>
              Con el botón de la tarjeta, en otra pestaña. Crea la cuenta si no la tienes.
            </li>
            <li className="rounded-xl border border-rule bg-paper p-3">
              <strong className="block text-ink">2. Carga saldo y crea una clave</strong>
              Sin saldo, la clave no funciona. Copia la clave al crearla: solo se ve una vez.
            </li>
            <li className="rounded-xl border border-rule bg-paper p-3">
              <strong className="block text-ink">3. Vuelve y pégala aquí</strong>
              MarchaSolo la comprueba y la guarda cifrada. Tu progreso te espera aquí.
            </li>
          </ol>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">
              Recomendada: Anthropic
              <span className="font-normal text-graphite">
                {fromTrial ? " · es la IA que te ha preparado el plan" : " · da muy buenos resultados redactando y razonando"}
              </span>
            </p>
            <div ref={recommendedBox} className="setup-cards flex flex-col gap-3">
              {cards.recommended}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">
              ¿Ya tienes otra? <span className="font-normal text-graphite">Sirve cualquiera. DeepSeek es la más económica.</span>
            </p>
            <div className="setup-cards flex flex-col gap-3">{cards.others}</div>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => startCheck(check)}
              disabled={checking}
              className="font-semibold text-link underline underline-offset-4 disabled:opacity-60"
            >
              {checking ? "Comprobando…" : "Ya la conecté, comprobar"}
            </button>
            <Link href={`${base}/integraciones#llms`} className="text-graphite underline underline-offset-4">
              Abrir en Integraciones
            </Link>
          </p>
          {error && <p className="text-sm text-alert">{error}</p>}
        </div>
      ) : (
        <p className="rounded-2xl border border-rule bg-paper p-5 text-sm text-graphite">
          Solo un administrador del espacio puede conectar la IA. Pídeselo; mientras tanto puedes seguir.
        </p>
      )}

      {finishError && <p className="text-sm text-alert">{finishError}</p>}

      <div className="flex flex-col gap-3">
        {status !== "connected" ? (
          <button
            type="button"
            onClick={onFinishDraft}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink px-5 font-medium text-ink disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar el plan como borrador y terminar"}
          </button>
        ) : null}
        <p className="text-xs text-graphite">
          Sin tu IA no se ejecuta nada. El plan no se pierde: puedes conectar la clave cuando quieras.
        </p>
        <button type="button" onClick={onBack} className="text-sm text-graphite">
          ← Volver al plan
        </button>
      </div>
    </section>
  )
}

// Bienvenida visual: presenta MarchaSolo antes de pedir la primera tarea.
function Intro() {
  return (
    <section aria-labelledby="intro-title" className="relative isolate overflow-hidden rounded-[24px] border border-[#243653] bg-[#0b1f3b] px-6 py-7 text-white shadow-[0_24px_70px_rgba(11,31,59,.16)] sm:px-8 sm:py-9">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#00c2a8]/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-[#6478ff]/15 blur-3xl" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#00c2a8] shadow-[0_0_16px_rgba(0,194,168,.8)]" /><p className="text-[10px] font-bold tracking-[.18em] text-[#9de9df]">TU ESPACIO INTELIGENTE</p></div>
        <div className="onboarding-orb-enter flex items-center justify-center py-1 sm:py-3">
          <svg viewBox="0 0 240 150" className="onboarding-orb-float h-[112px] w-[210px] sm:h-[145px] sm:w-[250px]" role="img" aria-label="Una esfera luminosa que representa tu equipo digital">
            <defs>
              <radialGradient id="ms-orb-core" cx="32%" cy="25%" r="75%"><stop offset="0%" stopColor="#e2fffb" /><stop offset="24%" stopColor="#72e8dc" /><stop offset="58%" stopColor="#00c2a8" /><stop offset="100%" stopColor="#176c83" /></radialGradient>
              <linearGradient id="ms-orb-ring" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#b5fff5" stopOpacity=".9" /><stop offset="100%" stopColor="#667cff" stopOpacity=".12" /></linearGradient>
              <filter id="ms-orb-glow"><feGaussianBlur stdDeviation="9" /></filter>
            </defs>
            <ellipse cx="120" cy="132" rx="67" ry="8" fill="#00c2a8" opacity=".16" filter="url(#ms-orb-glow)" />
            <ellipse className="onboarding-orbit onboarding-orbit-a" cx="120" cy="77" rx="78" ry="30" fill="none" stroke="url(#ms-orb-ring)" strokeWidth="1.2" opacity=".65" transform="rotate(-18 120 77)" />
            <ellipse className="onboarding-orbit onboarding-orbit-b" cx="120" cy="77" rx="78" ry="30" fill="none" stroke="#8d9dff" strokeWidth="1" opacity=".35" transform="rotate(34 120 77)" />
            <circle cx="120" cy="72" r="48" fill="#00c2a8" opacity=".22" filter="url(#ms-orb-glow)" /><circle className="onboarding-orb-core" cx="120" cy="72" r="39" fill="url(#ms-orb-core)" />
            <path d="M94 56c8-17 25-23 40-19" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55" />
            <circle className="onboarding-orb-spark onboarding-orb-spark-a" cx="178" cy="43" r="3" fill="#b5fff5" /><circle className="onboarding-orb-spark onboarding-orb-spark-b" cx="62" cy="103" r="2.5" fill="#8d9dff" /><circle className="onboarding-orb-spark onboarding-orb-spark-c" cx="164" cy="111" r="2" fill="#00c2a8" />
          </svg>
        </div>
        <div className="max-w-xl">
          <h2 id="intro-title" className="text-balance text-[clamp(28px,4vw,38px)] font-semibold leading-[1.08] tracking-[-.045em]">Tu negocio. <span className="text-[#8de9df]">Tu equipo.</span><br />Tu manera de trabajar.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[#c2cede] sm:text-[15px]">Vamos a crear un equipo digital de IA adaptado a tu negocio. Empezamos por una tarea real; tú mantienes el control y apruebas cada acción.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[.07] px-3 py-1.5 text-xs text-[#dce8f4]"><svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="#8de9df" strokeWidth="1.8"><path d="M10 2.5 16 5v4.2c0 3.5-2.5 6.3-6 8.3-3.5-2-6-4.8-6-8.3V5l6-2.5Z"/><path d="m7 9.8 2 2 4-4" /></svg>Tú decides. Nada se ejecuta sin permiso.</span>
          <span className="text-xs text-[#8fa4bd]">Personalizado · Sin conocimientos técnicos</span>
        </div>
      </div>
    </section>
  )
}

// Paso 5: qué está listo y qué falta, con la acción que toca ahora. Si la IA y
// la herramienta del plan están conectadas, el plan se guarda como
// automatización y se abre su página para probarla o activarla.
function DoneStep({
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
  const ready = ai?.ok === true && toolReady
  const loading = ai === null || toolCheck === null
  const verificationError = ai?.error ?? (toolCheck?.ok === false ? toolCheck.error : null)

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
    { label: "Tu plan", ok: plan !== null, detail: plan?.name ?? "" },
    { label: "Tu IA", ok: ai?.error ? null : ai?.ok ?? null, detail: ai?.error ?? (ai?.ok ? (ai.label ?? "Conectada") : "Sin conectar: sin ella no se ejecuta nada") },
    ...neededConnections.map((connection) => ({
      label: CONNECTION_LABEL[connection],
      ok: toolCheck?.ok === true ? toolCheck.statuses[connection] ?? false : null,
      detail: toolCheck?.ok === false
        ? toolCheck.error
        : toolCheck?.statuses[connection] === true ? "Conectado" : "Sin conectar: lo necesita tu plan",
    })),
  ]

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">{stepLabel}</p>
        <h2 className="rotulo text-xl mt-1">{ready ? "Preparado para probar" : loading ? "Comprobando conexiones…" : verificationError ? "No pude verificar toda la configuración" : "Configuración pendiente"}</h2>
        <p className="text-graphite mt-1">
          {ready
            ? "Tu plan y sus conexiones están preparados. Podrás probarlo antes de activarlo; nada se envía ni modifica sin tu aprobación."
            : loading
              ? "Estoy comprobando qué servicios están conectados."
              : verificationError ? "No voy a dar por conectada una herramienta si no he podido comprobarla. Puedes volver a intentarlo." : "Tu plan está guardado, pero todavía falta conectar los servicios que necesita para poder probarlo."}
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

      {isAdmin && ai?.ok && toolReady && neededConnections.includes("email") ? <InboxResult workspaceId={workspaceId} base={base} /> : null}

      {toolCheck?.ok === false ? <p className="text-sm text-alert" role="alert">{toolCheck.error}</p> : null}
      {error && <p className="text-sm text-alert">{error}</p>}

      {!loading ? (
        <div className="flex flex-col gap-3">
          {verificationError ? (
            <button type="button" onClick={() => {
              setAi(null)
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
              Seguir con este plan en el chat
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

