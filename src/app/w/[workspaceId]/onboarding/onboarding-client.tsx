"use client"

import Link from "next/link"
import type { FlowPlan } from "@/lib/plan"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react"
import { PlanView } from "@/components/plan-view"
import { AiStep } from "@/components/onboarding/ai-step"
import { SupervisedNote } from "@/components/onboarding/trust-cards"
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
  adoptBrowserTimezone,
  checkOnboardingAi,
  checkOnboardingTrial,
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
  { id: "plan", short: "Propuesta" },
  { id: "ai", short: "Tu IA" },
  { id: "connect", short: "Conectar" },
  { id: "done", short: "Listo" },
]
const STEP_ORDER = ONBOARDING_STEPS.map((s) => s.id)


// Ejemplos de los tres sectores (inmobiliarias, clínicas, profesionales).
// Cada uno cae en su plan sin IA (src/lib/onboarding-plans.ts).
// Orden pensado para Argentina y Latinoamérica: la bandeja (lo más fácil de
// conectar) y WhatsApp (el canal principal de los clientes) primero.
const SUGGESTIONS = [
  "Cada mañana, ordena la bandeja y déjame las respuestas urgentes preparadas",
  "Cuando un cliente escriba por WhatsApp, prepárame la respuesta con mis tarifas",
  "Cuando pidan una visita o una cita, ofrece dos horarios libres de mi agenda",
  "Cuando entre un lead, regístralo en el CRM y prepárame la primera respuesta",
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
  // El bloque «Afinar la propuesta» empieza abierto solo si ya había datos guardados.
  const [contextOpen, setContextOpen] = useState(Boolean(savedBusiness?.websiteUrl || savedBusiness?.businessType || savedBusiness?.mainPain || savedBusiness?.channels?.length))
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
  // «Tu IA» se salta si ya hay IA conectada o queda prueba gratuita: en ese caso
  // no hay nada que decidir y el paso solo añadía un clic.
  const [aiSkipped, setAiSkipped] = useState(false)
  const [pending, startTransition] = useTransition()

  // Cada paso comienza desde arriba, aunque el contenido nuevo sea más corto.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  // La zona horaria del espacio sale del navegador (Argentina, resto de
  // Latinoamérica o España) si todavía no tiene ninguna.
  useEffect(() => {
    if (!isAdmin) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) void adoptBrowserTimezone(workspaceId, tz)
  }, [isAdmin, workspaceId])

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
    if (target === "ai" && aiSkipped) return false
    return true
  }
  const goToStep = (target: Step) => {
    if (!canGoTo(target)) return
    setError(null)
    setStep(target)
  }

  const validateTask = useCallback((value: string) => {
    if (value.length < 12) {
      setError("Cuéntame un poco más, o pulsa «No sé todavía; ayúdame a descubrirlo».")
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
      const result = await enrichOnboardingWebsite({ workspaceId, url: websiteUrl })
      if (!result.ok) {
        setSemanticError(result.error)
        return
      }
      setBusinessProfile((current) => {
        if (!current) return result.profile
        return Object.fromEntries(BUSINESS_PROFILE_FIELDS.map(({ key }) => [
          key,
          editedProfileFields.has(key) || current[key].source === "user" || !result.profile[key].value ? current[key] : result.profile[key],
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

  // Contexto de la web confirmado por la persona, para preparar la propuesta.
  const buildWebsiteContext = (): string | undefined => {
    if (!websiteSnapshot || !businessProfile || !profileConfirmed) return undefined
    return [
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
  }

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (websiteSnapshot && !profileConfirmed) {
      setContextOpen(true)
      setError("Revisa y confirma el perfil de tu negocio antes de preparar la propuesta.")
      return
    }
    const requestedTask = task.trim() || "Ayúdame a descubrir qué tareas repetitivas de mi negocio puedo delegar y automatizar. Identifica oportunidades según la actividad, prioridades y canales que te indique; no des por ciertos datos que no conozcas."
    if (!validateTask(requestedTask) || pending) return
    setTask(requestedTask)

    startTransition(async () => {
      const websiteContext = buildWebsiteContext()
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

  // Si se guardó un plan local antes de habilitar/restablecer la prueba,
  // permite regenerarlo con la IA de MarchaSolo sin reiniciar el onboarding.
  const retryWithMarchaSoloAi = () => {
    if (!plan || !task.trim() || pending || source === "trial") return
    setError(null)
    startTransition(async () => {
      const websiteContext = buildWebsiteContext()
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
      if (result.source !== "trial") {
        setError("La IA de prueba no pudo preparar la propuesta. Puedes volver a intentarlo o seguir con el borrador.")
        return
      }
      const savedPlan = await saveFlowPlan({ workspaceId, flowId, plan: result.plan, fileIds: [] })
      if (!savedPlan.ok) {
        setError(savedPlan.error || "No se pudo actualizar el borrador con el nuevo plan.")
        return
      }
      setReply(result.reply)
      setPlan(result.plan)
      setSource("trial")
      setConversationId(result.conversationId)
      setTrialRemaining(result.trialRemaining)
      setFlowId(savedPlan.flowId)
    })
  }

  // Plan aceptado → persistirlo una sola vez antes de continuar. Si ya hay IA
  // conectada o queda prueba gratuita, se salta «Tu IA».
  const acceptPlan = () => {
    if (!plan || pending) return
    setError(null)
    startTransition(async () => {
      const savedFlowId = await persistPlan()
      if (!savedFlowId) return
      const [ai, trial] = await Promise.all([
        checkOnboardingAi(workspaceId).catch(() => null),
        checkOnboardingTrial(workspaceId).catch(() => null),
      ])
      const ready = (ai?.ok && ai.connected) || (trial?.ok && trial.runAvailable)
      if (ready) {
        setAiSkipped(true)
        afterAi(savedFlowId)
      } else {
        setAiSkipped(false)
        setStep("ai")
      }
    })
  }

  // Después de la IA, la herramienta que pide el plan (si pide alguna).
  // savedFlowId: el borrador recién guardado (el estado aún no se ha actualizado).
  const afterAi = (savedFlowId?: string) => {
    if (requirements.length === 0) finish(savedFlowId)
    else {
      setConnectionIndex(0)
      setStep("connect")
    }
  }

  // Al llegar a «Listo» se marca el onboarding como terminado.
  const finish = (existingFlowId?: string) => {
    setError(null)
    startTransition(async () => {
      const savedFlowId = existingFlowId ?? (await persistPlan())
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

  // Pasos visibles: sin herramienta, «Conectar» no cuenta; con IA o prueba, «Tu IA» tampoco.
  const visibleSteps = ONBOARDING_STEPS.filter(
    (s) => !(s.id === "connect" && requirements.length === 0) && !(s.id === "ai" && aiSkipped),
  )
  const stepOrdinal = (id: Step) => {
    const i = visibleSteps.findIndex((s) => s.id === id)
    return i >= 0 ? i + 1 : 1
  }
  const stepTotal = visibleSteps.length

  return (
    <div className="setup flex flex-col gap-6 max-w-2xl mx-auto" data-step={step}>
      <div className="setup-header flex flex-col gap-2">
        <p className="app-eyebrow">PRIMEROS PASOS · {workspaceName.toUpperCase()}</p>
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
            <h2 className="rotulo text-xl mt-1">¿Qué te gustaría quitarte de encima?</h2>
            <p className="text-graphite mt-1">
              Elige un ejemplo o cuéntalo con tus palabras. Te preparamos una propuesta en unos segundos, sin conectar nada todavía.
            </p>
          </div>

          <form onSubmit={handleTaskSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="task" className="text-sm font-semibold text-ink">¿Qué debería hacer MarchaSolo por ti?</label>
              <p className="text-xs text-graphite">Describe el resultado que buscas, no hace falta saber cómo automatizarlo. Si no lo tienes claro, déjalo vacío y te ayudaremos a descubrir oportunidades.</p>
            </div>
            <textarea
              id="task"
              value={task}
              onChange={(e) => {
                setTask(e.target.value)
                if (error) setError(null)
              }}
              rows={4}
              maxLength={500}
              placeholder="Ej.: quiero responder más rápido a las consultas, preparar presupuestos y no olvidarme del seguimiento de clientes."
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

            {/* Opcional y plegado: la web y el contexto del negocio afinan la propuesta, pero no frenan a quien solo quiere probar. */}
            <details
              className="rounded-xl border border-rule bg-paper"
              open={contextOpen}
              onToggle={(e) => setContextOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
                Afinar la propuesta con mi web y mi negocio <span className="font-normal text-graphite">(opcional)</span>
              </summary>
              <div className="flex flex-col gap-4 px-4 pb-4">
              <BusinessContextFields
                websiteUrl={websiteUrl}
                onWebsiteUrlChange={(value) => {
                  setWebsiteUrl(value)
                  setWebsiteSnapshot(null)
                  setBusinessProfile(null)
                  setProfileConfirmed(false)
                  setWebsiteError(null)
                  setSemanticError(null)
                  setSemanticMessage(null)
                  setEditedProfileFields(new Set())
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
                    [key]: { ...current[key], value, evidence: [], evidenceSources: [], confidence: "low", source: "user", confirmed: false },
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
              </div>
            </details>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
            >
              {pending ? "Preparando tu propuesta…" : "Preparar mi propuesta →"}
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
                Preparada por nuestra IA, por cuenta de MarchaSolo
                {trialRemaining !== null
                  ? trialRemaining > 0
                    ? ` (puedes pedir ${trialRemaining} ${trialRemaining === 1 ? "propuesta más" : "propuestas más"})`
                    : " (era tu última propuesta gratis)"
                  : ""}
                . Podrás probarla gratis con nuestra IA, sin conectar la tuya.
              </p>
            )}
            {source === "local" && (
              <p className="mt-2 text-xs text-graphite">
                Propuesta orientativa preparada sin IA. Con IA, podremos adaptarla mejor a tu negocio.
              </p>
            )}
          </div>

          <PlanView plan={plan} animated />

          <SupervisedNote plan={plan} />


          <div className="flex flex-wrap gap-3">
            <button
              onClick={acceptPlan}
              disabled={pending}
              className="inline-flex h-11 items-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
            >
              {pending ? "Guardando la propuesta…" : "Me gusta, seguir →"}
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
          onContinue={() => afterAi()}
          onRetryTrial={retryWithMarchaSoloAi}
          onFinishDraft={() => finish()}
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
          backLabel={aiSkipped ? "← Volver a la propuesta" : "← Volver a tu IA"}
          onBack={() => setStep(aiSkipped ? "plan" : "ai")}
          onContinue={() => finish()}
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
          onConnectAi={() => {
            setAiSkipped(false)
            setStep("ai")
          }}
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

// Bienvenida: presenta MarchaSolo antes de pedir la primera tarea. Compacta,
// para que en el celular la pregunta del paso 1 se vea sin desplazarse mucho.
// Marca clara (decisión del 2 nov): fondo claro, azul marino y turquesa; sin
// modo oscuro ni brillos violeta.
function Intro() {
  return (
    <section aria-labelledby="intro-title" className="relative overflow-hidden rounded-[24px] border border-rule bg-[#f3f6fa] px-5 py-5 text-[#0b1f3b] sm:px-8 sm:py-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        <svg viewBox="0 0 120 120" className="onboarding-orb-enter hidden h-20 w-20 shrink-0 sm:block" role="img" aria-label="El anillo de MarchaSolo">
          <circle cx="60" cy="60" r="44" fill="none" stroke="#0b1f3b" strokeOpacity=".12" strokeWidth="10" />
          <circle cx="60" cy="60" r="44" fill="none" stroke="#00c2a8" strokeWidth="10" strokeLinecap="round" strokeDasharray="190 87" transform="rotate(-90 60 60)" />
          <circle cx="60" cy="60" r="14" fill="#34d399" />
        </svg>
        <div className="max-w-xl">
          <p className="text-[11px] font-bold tracking-[.16em] text-[#007a6c]">TU ESPACIO DE TRABAJO</p>
          <h2 id="intro-title" className="mt-2 text-balance text-[clamp(22px,4vw,30px)] font-semibold leading-[1.1] tracking-[-.03em]">
            Tu negocio. <span className="text-[#007a6c]">Tu equipo.</span>
            <br />
            Tu manera de trabajar.
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-graphite sm:text-[15px]">MarchaSolo prepara el trabajo repetitivo de tu negocio. Tú revisas y apruebas cada acción antes de que salga.</p>
        </div>
      </div>
    </section>
  )
}

// Paso 5: qué está listo y qué falta, con la acción que toca ahora. Si la IA y
// la herramienta del plan están conectadas, el plan se guarda como
// automatización y se abre su página para probarla o activarla.

