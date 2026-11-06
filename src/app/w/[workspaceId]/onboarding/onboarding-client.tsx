"use client"

import Link from "next/link"
import type { FlowPlan } from "@/lib/plan"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react"
import { PlanView } from "@/components/plan-view"
import { AiStep } from "@/components/onboarding/ai-step"
import { DemoApprovalCard, SupervisedNote } from "@/components/onboarding/trust-cards"
import { ConnectStep } from "@/components/onboarding/connect-step"
import { DoneStep } from "@/components/onboarding/done-step"
import { BusinessContextFields } from "@/components/onboarding/business-context-fields"
import {
  chatHref,
  clearOnboarding,
  CONNECTION_LABEL,
  loadOnboarding,
  requiredConnections,
  saveOnboarding,
  type OnboardingConnection,
  type OnboardingSource,
  type OnboardingStep,
} from "@/lib/onboarding"
import type { WebsiteSnapshot } from "@/lib/business-discovery/website-parser"
import { BUSINESS_PROFILE_FIELDS, type BusinessProfile } from "@/lib/business-discovery/business-profile"
import { saveFlowPlan } from "../flow-editor-actions"
import {
  analyzeOnboardingWebsite,
  enrichOnboardingWebsite,
  checkOnboardingConnections,
  completeOnboarding,
  generateOnboardingPlan,
  trackOnboardingStep,
} from "./actions"

type Step = OnboardingStep

const Check = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

const ONBOARDING_STEPS: { id: Step; short: string }[] = [
  { id: "task", short: "Tarea" },
  { id: "plan", short: "Plan" },
  { id: "ai", short: "Tu IA" },
  { id: "connect", short: "Conectar" },
  { id: "done", short: "Listo" },
]
const STEP_ORDER = ONBOARDING_STEPS.map((s) => s.id)


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
  const savedBusiness = saved?.businessContext
  const [businessType, setBusinessType] = useState(savedBusiness?.businessType ?? "")
  const [mainPain, setMainPain] = useState(savedBusiness?.mainPain ?? "")
  const [channels, setChannels] = useState<string[]>(savedBusiness?.channels ?? [])
  const [websiteUrl, setWebsiteUrl] = useState(savedBusiness?.websiteUrl ?? "")
  const [websiteSnapshot, setWebsiteSnapshot] = useState<WebsiteSnapshot | null>(savedBusiness?.websiteSnapshot ?? null)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(savedBusiness?.businessProfile ?? null)
  const [profileConfirmed, setProfileConfirmed] = useState(savedBusiness?.profileConfirmed ?? false)
  const [websiteError, setWebsiteError] = useState<string | null>(null)
  const [websitePending, setWebsitePending] = useState(false)
  const [semanticPending, setSemanticPending] = useState(false)
  const [semanticError, setSemanticError] = useState<string | null>(null)
  const [semanticMessage, setSemanticMessage] = useState<string | null>(null)
  const [editedProfileFields, setEditedProfileFields] = useState<Set<keyof BusinessProfile>>(() => new Set())
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
    if (step === "done" || (step === "task" && !task.trim() && !websiteUrl.trim() && !businessType && !mainPain && channels.length === 0)) {
      clearOnboarding(workspaceId)
      return
    }
    saveOnboarding(workspaceId, {
      step, task, reply, plan, source, conversationId, trialRemaining, flowId,
      businessContext: { websiteUrl, websiteSnapshot, businessProfile, profileConfirmed, businessType, mainPain, channels },
    })
  }, [workspaceId, step, task, reply, plan, source, conversationId, trialRemaining, flowId, websiteUrl, websiteSnapshot, businessProfile, profileConfirmed, businessType, mainPain, channels])

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

  const validateTask = useCallback((value: string) => {
    if (value.length < 12) {
      setError("Cuéntame un poco más o utiliza la opción de descubrir oportunidades.")
      return false
    }
    if (value.length > 500) {
      setError("Máximo 500 caracteres.")
      return false
    }
    setError(null)
    return true
  }, [])

  const handleWebsiteAnalysis = async () => {
    if (!websiteUrl.trim() || pending || websitePending) return
    setWebsiteError(null)
    setSemanticError(null)
    setSemanticMessage(null)
    setEditedProfileFields(new Set())
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

  const handleSemanticEnrichment = async () => {
    if (!websiteSnapshot || semanticPending || websitePending) return
    setSemanticError(null)
    setSemanticMessage(null)
    setSemanticPending(true)
    try {
      const result = await enrichOnboardingWebsite({ workspaceId, snapshot: websiteSnapshot })
      if (!result.ok) {
        setSemanticError(result.error)
        return
      }
      setBusinessProfile((current) => {
        if (!current) return result.profile
        return Object.fromEntries(BUSINESS_PROFILE_FIELDS.map(({ key }) => [
          key,
          editedProfileFields.has(key) || !result.profile[key].value ? current[key] : result.profile[key],
        ])) as BusinessProfile
      })
      setProfileConfirmed(false)
      setSemanticMessage(result.trial
        ? "Análisis completado con un crédito de prueba de MarchaSolo."
        : `Análisis completado con ${result.model}.`)
    } catch {
      setSemanticError("No se pudo completar el análisis con IA. Puedes seguir con el análisis inicial.")
    } finally {
      setSemanticPending(false)
    }
  }

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (websiteSnapshot && !profileConfirmed) {
      setError("Revisa y confirma el perfil de tu negocio antes de preparar la propuesta.")
      return
    }
    const requestedTask = task.trim() || "Ayúdame a descubrir qué tareas repetitivas de mi negocio puedo delegar y automatizar. Identifica oportunidades según la actividad, prioridades y canales que te indique; no des por ciertos datos que no conozcas."
    if (!validateTask(requestedTask) || pending) return
    setTask(requestedTask)

    startTransition(async () => {
      const websiteContext = websiteSnapshot && businessProfile && profileConfirmed
        ? [
            websiteSnapshot.title ? `Título de la web: ${websiteSnapshot.title}` : "",
            websiteSnapshot.description ? `Descripción pública: ${websiteSnapshot.description}` : "",
            websiteSnapshot.language ? `Idioma detectado: ${websiteSnapshot.language}` : "",
            ...BUSINESS_PROFILE_FIELDS.map(({ key, label }) => {
              const field = businessProfile[key]
              const value = field.value.trim()
              if (!value) return ""
              const evidence = field.evidence[0] ? ` Evidencia: ${field.evidence[0]}` : ""
              const sourceUrl = field.evidenceSources[0] ? ` Fuente: ${field.evidenceSources[0]}` : ""
              return `${label}: ${value}.${evidence}${sourceUrl}`
            }),
          ].filter(Boolean).join("\n").slice(0, 3_000)
        : undefined
      const result = await generateOnboardingPlan({
        workspaceId,
        message: requestedTask,
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
            <h2 className="rotulo text-xl mt-1">¿Qué te gustaría mejorar en tu negocio?</h2>
            <p className="text-graphite mt-1">
              Puedes describir una tarea concreta o contarnos cómo funciona tu negocio. Si todavía no sabes qué delegar, MarchaSolo te ayudará a descubrir oportunidades. No hace falta conectar nada todavía.
            </p>
          </div>

          <form onSubmit={handleTaskSubmit} className="flex flex-col gap-4">
            <BusinessContextFields
              websiteUrl={websiteUrl}
              onWebsiteUrlChange={(value) => {
                setWebsiteUrl(value)
                setWebsiteSnapshot(null)
                setBusinessProfile(null)
                setProfileConfirmed(false)
                setWebsiteError(null)
              }}
              onAnalyzeWebsite={handleWebsiteAnalysis}
              onEnrichWebsite={handleSemanticEnrichment}
              semanticPending={semanticPending}
              semanticError={semanticError}
              semanticMessage={semanticMessage}
              websitePending={websitePending}
              disabled={pending}
              websiteError={websiteError}
              websiteSnapshot={websiteSnapshot}
              businessProfile={businessProfile}
              onProfileFieldChange={(key, value) => {
                setEditedProfileFields((current) => new Set(current).add(key))
                setBusinessProfile((current) => current ? {
                  ...current,
                  [key]: { ...current[key], value, confirmed: false },
                } : current)
                setProfileConfirmed(false)
              }}
              profileConfirmed={profileConfirmed}
              onConfirmProfile={() => setProfileConfirmed(true)}
              onRemoveAnalysis={() => {
                setWebsiteSnapshot(null)
                setBusinessProfile(null)
                setProfileConfirmed(false)
                setSemanticError(null)
                setSemanticMessage(null)
                setEditedProfileFields(new Set())
              }}
              businessType={businessType}
              onBusinessTypeChange={setBusinessType}
              mainPain={mainPain}
              onMainPainChange={setMainPain}
              channels={channels}
              onChannelChange={(value, checked) => setChannels((current) => checked
                ? [...current, value]
                : current.filter((channel) => channel !== value))}
            />
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
              placeholder="Ej.: pierdo mucho tiempo respondiendo consultas, preparando presupuestos y haciendo seguimiento de clientes."
              className="w-full rounded-xl border border-rule bg-paper px-4 py-3 text-ink placeholder:text-graphite focus:border-stroke focus:outline-none"
            />
            {error && <p className="text-sm text-alert">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { setTask(""); setError(null) }} className="rounded-full border border-dashed border-ink px-3 py-1.5 text-sm font-semibold text-ink hover:bg-sheet">No sé todavía; ayúdame a descubrirlo</button>
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
            <h2 className="rotulo text-xl mt-1">Tu propuesta de trabajo</h2>
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
                Plan orientativo creado sin IA. Al conectar tu IA, podremos adaptarlo mejor a tu negocio.
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

