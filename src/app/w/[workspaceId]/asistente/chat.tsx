"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { PlanView } from "@/components/plan-view"
import type { Pending } from "@/lib/pending"
import type { FlowPlan } from "@/lib/plan"
import { speak, unlockSpeech } from "@/lib/speech"
import { saveFlowFromMessage, sendAssistantMessage } from "../ai-actions"
import { ApprovalCard, RunControls } from "../ejecuciones/[runId]/run-live"
import { startRunFromMessage } from "../run-actions"
import { AutoReadToggle, DictateButton, ListenButton, useAutoRead } from "./voice"

export type ChatMessage = {
  key: string
  id: number | null
  role: "user" | "assistant"
  content: string
  plan: FlowPlan | null
}

// Última ejecución lanzada desde un mensaje del chat («Ejecutar ahora»).
export type ChatRun = {
  id: string
  status: string
  pending: Pending | null
  summary: string | null
  error: string | null
  lastEvent: string | null
}

export type ChatFile = { id: string; name: string; kind: string }

const EXAMPLES = [
  "¿Qué reuniones tengo mañana?",
  "Añade a la planilla de gastos una factura de 120 € de Leroy Merlin con fecha de hoy.",
  "Cada lunes, revisa la planilla de obras y avísame de las que tienen la entrega esta semana.",
]

const FILE_CONNECTIONS = new Set(["spreadsheet", "documents", "drive"])

function needsFiles(plan: FlowPlan): boolean {
  return plan.connections.some((c) => FILE_CONNECTIONS.has(c.kind)) || plan.steps.some((s) => FILE_CONNECTIONS.has(s.connection))
}

export function Chat({
  workspaceId,
  conversationId,
  initialMessages,
  runs,
  files,
  aiReady,
  initialDraft = "",
}: {
  workspaceId: string
  conversationId: string | null
  initialMessages: ChatMessage[]
  runs: Record<number, ChatRun>
  files: ChatFile[]
  aiReady: boolean
  // Petición escrita en «Pide algo a Orkesta» (pantalla Hoy). Se deja en el
  // cuadro para revisarla: no se envía sola.
  initialDraft?: string
}) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState(initialDraft)
  const [error, setError] = useState<{ code: string; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const autoRead = useAutoRead()
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages.length, pending])

  // El cuadro de texto crece con el contenido (también al dictar), hasta 10 rem.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  function send(text: string) {
    const message = text.trim()
    if (!message || pending) return
    setError(null)
    if (autoRead) unlockSpeech()
    setMessages((m) => [...m, { key: `local-${Date.now()}`, id: null, role: "user", content: message, plan: null }])
    setDraft("")

    startTransition(async () => {
      const result = await sendAssistantMessage({ workspaceId, conversationId, message })
      if (!result.ok) {
        setError({ code: result.code, text: result.error })
        return
      }
      if (autoRead) speak(`m-${result.messageId ?? "nuevo"}`, result.reply)
      if (!conversationId) {
        // Conversación nueva: la página se vuelve a cargar con ella desde la base de datos.
        router.replace(`/w/${workspaceId}/asistente?c=${result.conversationId}`)
        return
      }
      setMessages((m) => [
        ...m,
        { key: `local-a-${Date.now()}`, id: result.messageId, role: "assistant", content: result.reply, plan: result.plan },
      ])
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <div className="border border-ink bg-sheet p-5">
          <p className="text-ink">Pídele al asistente lo que necesites, escribiendo o por voz.</p>
          <p className="mt-1 text-sm text-graphite">
            Te propondrá un plan. Puedes ejecutarlo al momento o guardarlo como automatización. Lo que tenga que escribir o
            enviar espera siempre tu aprobación.
          </p>
          <details className="chat-examples mt-4 border border-rule">
            <summary className="chat-examples-summary flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-semibold text-ink">
              Ejemplos de lo que puedes pedir
            </summary>
            <ul className="flex flex-col gap-2 border-t border-rule p-3">
              {EXAMPLES.map((e) => (
                <li key={e}>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(e)
                      inputRef.current?.focus()
                    }}
                    className="w-full border border-rule px-3 py-2 text-left text-sm text-ink hover:border-stroke hover:bg-paper"
                  >
                    {e}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <ol className="flex flex-col gap-4" aria-label="Conversación">
          {messages.map((m) => (
            <li key={m.key} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <p className="max-w-[85%] border border-rule bg-paper px-4 py-2.5 whitespace-pre-wrap text-ink">{m.content}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="whitespace-pre-wrap text-ink">{m.content}</p>
                  <div className="-mt-1">
                    <ListenButton id={`m-${m.id ?? m.key}`} text={m.content} />
                  </div>
                  {m.plan ? (
                    <>
                      <PlanView plan={m.plan} />
                      {m.id !== null ? (
                        <PlanActions
                          workspaceId={workspaceId}
                          messageId={m.id}
                          plan={m.plan}
                          run={runs[m.id] ?? null}
                          files={files}
                          aiReady={aiReady}
                        />
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </li>
          ))}
          {pending ? (
            <li className="text-sm text-graphite" role="status">
              Preparando el plan… puede tardar hasta un minuto.
            </li>
          ) : null}
        </ol>
      )}

      {error ? (
        <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
          {error.text}{" "}
          {error.code === "no_connection" || error.code === "invalid_key" ? (
            <Link href={`/w/${workspaceId}/integraciones`} className="underline underline-offset-4">
              Ir a Integraciones
            </Link>
          ) : null}
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
        // En el móvil el cuadro queda fijo encima de la barra inferior.
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 flex items-end gap-2 border border-ink bg-sheet p-2 lg:static"
      >
        <DictateButton
          workspaceId={workspaceId}
          disabled={pending}
          onError={(text) => setError(text ? { code: "voice", text } : null)}
          onText={(text) => {
            setDraft((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text))
            inputRef.current?.focus()
          }}
        />
        <label htmlFor="assistant-input" className="sr-only">
          Mensaje para el asistente
        </label>
        <textarea
          id="assistant-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send(draft)
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={messages.length ? "Pide cambios o algo nuevo…" : "Escribe o dicta lo que necesitas…"}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-base leading-6 text-ink placeholder:text-graphite/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="h-10 shrink-0 bg-stroke px-4 text-sm font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "…" : "Enviar"}
        </button>
      </form>
      <div ref={endRef} className="-mt-2 flex flex-wrap items-center justify-between gap-2">
        <AutoReadToggle />
        <span className="hidden text-xs text-graphite md:inline">Intro para enviar, Mayús+Intro para nueva línea</span>
      </div>
    </div>
  )
}

// Acciones sobre un plan: ejecutarlo ahora (solo los manuales) o guardarlo.
// Si ya se ejecutó desde aquí, muestra el estado de esa ejecución.
function PlanActions({
  workspaceId,
  messageId,
  plan,
  run,
  files,
  aiReady,
}: {
  workspaceId: string
  messageId: number
  plan: FlowPlan
  run: ChatRun | null
  files: ChatFile[]
  aiReady: boolean
}) {
  const router = useRouter()
  const manual = plan.trigger.type === "manual"
  const wantsFiles = needsFiles(plan)
  const [selected, setSelected] = useState<string[]>(wantsFiles && files.length === 1 ? [files[0].id] : [])
  const [error, setError] = useState<string | null>(null)
  const [starting, startRun] = useTransition()
  const base = `/w/${workspaceId}`
  const active = run && (run.status === "running" || run.status === "awaiting_approval")

  function execute() {
    setError(null)
    startRun(async () => {
      const result = await startRunFromMessage({ workspaceId, messageId, fileIds: selected })
      if (!result.ok) setError(result.error)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {run ? <RunInChat run={run} base={base} /> : null}

      {!active ? (
        <>
          {manual && wantsFiles && files.length > 0 ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm font-medium text-ink">Archivos que puede usar (máximo 5)</legend>
              {files.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={selected.includes(f.id)}
                    onChange={() =>
                      setSelected((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : s.length < 5 ? [...s, f.id] : s))
                    }
                  />
                  {f.name} <span className="text-xs text-graphite">({f.kind})</span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {manual && wantsFiles && files.length === 0 ? (
            <p className="text-sm text-graphite">
              Este plan usa archivos de Google y aún no hay ninguno elegido.{" "}
              <Link href={`${base}/integraciones`} className="text-link underline underline-offset-4">
                Elígelos en Integraciones
              </Link>
              .
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {manual ? (
              <button
                type="button"
                onClick={execute}
                disabled={starting || !aiReady || (wantsFiles && files.length > 0 && selected.length === 0)}
                className="h-10 bg-stroke px-5 text-sm font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-50"
              >
                {starting ? "Iniciando…" : run ? "Ejecutar otra vez" : "Ejecutar ahora"}
              </button>
            ) : null}
            <SavePlan workspaceId={workspaceId} messageId={messageId} primary={!manual} />
          </div>
          {manual ? <p className="text-xs text-graphite">Lee sin preguntar; lo que escriba o envíe espera tu aprobación.</p> : null}
        </>
      ) : null}
    </div>
  )
}

const RUN_LABEL: Record<string, string> = {
  running: "En curso",
  awaiting_approval: "Esperando tu aprobación",
  succeeded: "Hecho",
  failed: "No se pudo completar",
  cancelled: "Cancelada",
}

function RunInChat({ run, base }: { run: ChatRun; base: string }) {
  const autoRead = useAutoRead()
  const previous = useRef(run.status)

  // Lee el resultado en voz alta cuando termina, si está activada la lectura.
  useEffect(() => {
    if (previous.current !== "succeeded" && run.status === "succeeded" && autoRead && run.summary) speak(`r-${run.id}`, run.summary)
    previous.current = run.status
  }, [run.status, run.summary, run.id, autoRead])

  return (
    <section className="flex flex-col gap-3 border-l-2 border-stroke pl-4" aria-label="Ejecución">
      <p className="text-sm">
        <span className={`font-semibold ${run.status === "failed" ? "text-alert" : run.status === "succeeded" ? "text-ok" : "text-ink"}`}>
          {RUN_LABEL[run.status] ?? run.status}
        </span>{" "}
        ·{" "}
        <Link href={`${base}/ejecuciones/${run.id}`} className="text-link underline underline-offset-4">
          Ver detalle
        </Link>
      </p>
      {run.status === "awaiting_approval" && run.pending ? <ApprovalCard runId={run.id} pending={run.pending} /> : null}
      {run.status === "running" ? (
        <RunControls runId={run.id} status={run.status} workingText={run.lastEvent ? `Trabajando… ${run.lastEvent}` : "Trabajando…"} />
      ) : null}
      {run.status === "succeeded" && run.summary ? (
        <div className="flex flex-col gap-1 border border-ok bg-sheet px-4 py-3">
          <p className="whitespace-pre-wrap text-ink">{run.summary}</p>
          <div>
            <ListenButton id={`r-${run.id}`} text={run.summary} />
          </div>
        </div>
      ) : null}
      {run.status === "failed" && run.error ? (
        <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
          {run.error}
        </p>
      ) : null}
    </section>
  )
}

function SavePlan({ workspaceId, messageId, primary }: { workspaceId: string; messageId: number; primary: boolean }) {
  return (
    <form action={saveFlowFromMessage}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="messageId" value={messageId} />
      <SaveButton primary={primary} />
    </form>
  )
}

function SaveButton({ primary }: { primary: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        primary
          ? "h-10 bg-stroke px-5 text-sm font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-60"
          : "h-10 border border-ink bg-sheet px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
      }
    >
      {pending ? "Guardando…" : "Guardar como automatización"}
    </button>
  )
}
