"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

type Step = "task" | "plan" | "connect" | "supervised" | "done"

type ProposedPlan = {
  name: string
  summary: string
  neededConnection: "email" | "spreadsheet" | "calendar" | "none"
  connectionLabel: string
  steps: { title: string; description: string; requiresApproval: boolean }[]
}

const SUGGESTIONS = [
  "Clasificar y responder correos de clientes",
  "Actualizar una planilla cuando llegue un pedido",
  "Preparar un resumen semanal de ventas",
  "Crear eventos en el calendario desde mensajes",
  "Preparar borradores de respuesta a presupuestos",
]

function detectPlan(text: string): ProposedPlan {
  const t = text.toLowerCase()

  if (t.includes("correo") || t.includes("email") || t.includes("gmail") || t.includes("bandeja") || t.includes("responder")) {
    return {
      name: "Clasificar y preparar respuestas de correo",
      summary: "Lee los correos recientes, los clasifica por urgencia y prepara borradores de respuesta para que tú apruebes.",
      neededConnection: "email",
      connectionLabel: "Correo (IMAP)",
      steps: [
        { title: "Leer correos recientes", description: "Consulta la bandeja de los últimos días.", requiresApproval: false },
        { title: "Clasificar por urgencia y tipo", description: "Agrupa urgentes, clientes, facturas y boletines.", requiresApproval: false },
        { title: "Preparar borradores", description: "Redacta respuestas solo para los que lo necesitan.", requiresApproval: true },
        { title: "Mostrarte las propuestas", description: "Tú decides qué se envía.", requiresApproval: true },
      ],
    }
  }

  if (t.includes("planilla") || t.includes("hoja") || t.includes("excel") || t.includes("sheets") || t.includes("ventas") || t.includes("pedido")) {
    return {
      name: "Actualizar planilla desde mensajes o pedidos",
      summary: "Lee la información que indiques y actualiza las filas correspondientes en tu planilla, siempre con tu aprobación.",
      neededConnection: "spreadsheet",
      connectionLabel: "Google Drive / Planillas",
      steps: [
        { title: "Localizar la planilla", description: "Usa solo los archivos que hayas autorizado.", requiresApproval: false },
        { title: "Leer el rango necesario", description: "Consulta las filas relevantes.", requiresApproval: false },
        { title: "Preparar las filas a escribir", description: "Muestra exactamente qué se va a añadir o modificar.", requiresApproval: true },
        { title: "Escribir tras tu aprobación", description: "Solo escribe cuando tú lo autorices.", requiresApproval: true },
      ],
    }
  }

  if (t.includes("calendario") || t.includes("cita") || t.includes("reunión") || t.includes("agenda") || t.includes("evento")) {
    return {
      name: "Gestionar citas y eventos",
      summary: "Consulta tu agenda y propone eventos. Nunca crea nada sin tu aprobación.",
      neededConnection: "calendar",
      connectionLabel: "Google Calendar",
      steps: [
        { title: "Consultar la agenda", description: "Lee los próximos eventos del calendario principal.", requiresApproval: false },
        { title: "Proponer el evento", description: "Muestra fecha, hora, título e invitados.", requiresApproval: true },
        { title: "Crear solo si apruebas", description: "El evento se crea únicamente tras tu autorización.", requiresApproval: true },
      ],
    }
  }

  // Fallback genérico
  return {
    name: "Automatización a medida",
    summary: text.trim().slice(0, 160),
    neededConnection: "none",
    connectionLabel: "Ninguna por ahora",
    steps: [
      { title: "Entender la petición", description: "Analiza lo que has descrito.", requiresApproval: false },
      { title: "Proponer un plan concreto", description: "Desglosa los pasos necesarios.", requiresApproval: false },
      { title: "Ejecutar con tu supervisión", description: "Cada acción sensible te pedirá aprobación.", requiresApproval: true },
    ],
  }
}

export function OnboardingClient({
  workspaceId,
  workspaceName,
  isAdmin,
  userName,
}: {
  workspaceId: string
  workspaceName: string
  isAdmin: boolean
  userName: string
}) {
  const base = `/w/${workspaceId}`
  const [step, setStep] = useState<Step>("task")
  const [task, setTask] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<ProposedPlan | null>(null)
  const [supervisedAccepted, setSupervisedAccepted] = useState(false)
  const [loading, setLoading] = useState(false)

  const progress = useMemo(() => {
    const order: Step[] = ["task", "plan", "connect", "supervised", "done"]
    return ((order.indexOf(step) + 1) / order.length) * 100
  }, [step])

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
    if (!validateTask()) return
    setLoading(true)
    // Simulación de generación de plan (aquí se puede llamar a la Edge Function assistant)
    setTimeout(() => {
      const proposed = detectPlan(task)
      setPlan(proposed)
      setStep("plan")
      setLoading(false)
    }, 600)
  }

  const acceptPlan = () => {
    if (!plan) return
    if (plan.neededConnection === "none") {
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
    setStep("done")
  }

  return (
    <div className="setup flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex flex-col gap-2">
        <p className="app-eyebrow">ONBOARDING · {workspaceName.toUpperCase()}</p>
        <h1 className="rotulo text-2xl">
          {userName ? `Hola ${userName}, ` : ""}vamos a poner MarchaSolo en marcha
        </h1>
        <div className="setup-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* STEP 1: Task */}
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
              disabled={loading}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
            >
              {loading ? "Preparando el plan…" : "Ver cómo lo resolvería →"}
            </button>
          </form>
        </section>
      )}

      {/* STEP 2: Plan */}
      {step === "plan" && plan && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 2 de 5</p>
            <h2 className="rotulo text-xl mt-1">Así lo resolvería</h2>
            <p className="text-graphite mt-1">{plan.summary}</p>
          </div>

          <div className="rounded-2xl border border-rule bg-paper p-5">
            <h3 className="font-semibold text-ink mb-3">{plan.name}</h3>
            <ol className="flex flex-col gap-3">
              {plan.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stroke text-xs font-bold text-stroke-ink">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{s.title}</p>
                    <p className="text-sm text-graphite">{s.description}</p>
                    {s.requiresApproval && (
                      <span className="mt-1 inline-block text-xs font-medium text-stroke">Requiere tu aprobación</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={acceptPlan} className="inline-flex h-11 items-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink">
              Me gusta, continuar →
            </button>
            <button
              onClick={() => setStep("task")}
              className="inline-flex h-11 items-center rounded-xl border border-ink px-5 font-medium text-ink"
            >
              Cambiar la tarea
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Connect only what is needed */}
      {step === "connect" && plan && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 3 de 5</p>
            <h2 className="rotulo text-xl mt-1">Solo necesito una cosa</h2>
            <p className="text-graphite mt-1">
              Para ejecutar este plan necesito acceso a <strong>{plan.connectionLabel}</strong>.
              No te pediré el resto de aplicaciones ahora.
            </p>
          </div>

          <div className="rounded-2xl border border-rule bg-paper p-5 flex flex-col gap-3">
            <p className="text-sm text-graphite">
              • Tus credenciales se cifran y se guardan en Vault.<br />
              • MarchaSolo nunca envía ni escribe nada sin tu aprobación.<br />
              • Puedes desconectar esta aplicación en cualquier momento.
            </p>
            <Link
              href={`${base}/integraciones`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink"
            >
              Conectar {plan.connectionLabel} →
            </Link>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={goToSupervised} className="text-sm font-semibold text-link underline underline-offset-4">
              Continuar sin conectar (modo demo)
            </button>
            <button onClick={() => setStep("plan")} className="text-sm text-graphite">
              ← Volver al plan
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: Supervised mode */}
      {step === "supervised" && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 4 de 5</p>
            <h2 className="rotulo text-xl mt-1">Modo supervisado</h2>
            <p className="text-graphite mt-1">
              En las primeras ejecuciones MarchaSolo te mostrará exactamente qué va a hacer antes de actuar.
            </p>
          </div>

          <div className="rounded-2xl border border-stroke bg-paper p-5">
            <p className="font-medium text-ink mb-2">Ejemplo de lo que verás:</p>
            <p className="text-sm text-graphite">
              «Voy a procesar 8 correos y preparar borradores de respuesta.
              <br />
              <strong>No enviaré ningún correo.</strong>»
            </p>
            <p className="mt-3 text-sm text-graphite">Tú decides si autorizas cada acción.</p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={supervisedAccepted}
              onChange={(e) => {
                setSupervisedAccepted(e.target.checked)
                if (error) setError(null)
              }}
              className="mt-1 h-4 w-4 rounded border-rule"
            />
            <span className="text-sm text-ink">
              Entiendo que las acciones que modifican datos o envían mensajes requerirán mi aprobación explícita.
            </span>
          </label>
          {error && <p className="text-sm text-alert">{error}</p>}

          <button
            onClick={finish}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink"
          >
            Entendido, continuar →
          </button>
        </section>
      )}

      {/* STEP 5: Done */}
      {step === "done" && (
        <section className="setup-panel flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-graphite">Paso 5 de 5</p>
            <h2 className="rotulo text-xl mt-1">Listo</h2>
            <p className="text-graphite mt-1">
              Ya puedes pedirle cosas a MarchaSolo. Empieza con una tarea sencilla y ve ganando confianza.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={`${base}/asistente`}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink"
            >
              Abrir el chat
            </Link>
            <Link
              href={base}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-ink px-5 font-medium text-ink"
            >
              Ir a Hoy
            </Link>
            {isAdmin && (
              <Link href={`${base}/integraciones`} className="text-sm font-semibold text-link underline underline-offset-4 text-center">
                Configurar más conexiones
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
