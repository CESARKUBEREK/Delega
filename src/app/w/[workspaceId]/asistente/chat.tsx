"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { PlanView } from "@/components/plan-view"
import type { FlowPlan } from "@/lib/plan"
import { saveFlowFromMessage, sendAssistantMessage } from "../ai-actions"

export type ChatMessage = {
  key: string
  id: number | null
  role: "user" | "assistant"
  content: string
  plan: FlowPlan | null
}

const EXAMPLES = [
  "Compara las ventas de este mes con las del anterior y prepárame un resumen para el equipo.",
  "Cada lunes, revisa la planilla de obras y avísame de las que tienen la entrega esta semana.",
  "Cuando llegue una factura nueva, copia el proveedor, el importe y la fecha a la planilla de gastos.",
]

export function Chat({
  workspaceId,
  conversationId,
  initialMessages,
}: {
  workspaceId: string
  conversationId: string | null
  initialMessages: ChatMessage[]
}) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<{ code: string; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [messages.length, pending])

  function send(text: string) {
    const message = text.trim()
    if (!message || pending) return
    setError(null)
    setMessages((m) => [...m, { key: `local-${Date.now()}`, id: null, role: "user", content: message, plan: null }])
    setDraft("")

    startTransition(async () => {
      const result = await sendAssistantMessage({ workspaceId, conversationId, message })
      if (!result.ok) {
        setError({ code: result.code, text: result.error })
        return
      }
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
          <p className="text-ink">Cuéntale al asistente qué tarea quieres automatizar, con tus palabras.</p>
          <p className="mt-1 text-sm text-graphite">
            Te propondrá un plan paso a paso. Nada se ejecuta: tú lo revisas y, si te sirve, lo guardas como automatización.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {EXAMPLES.map((e) => (
              <li key={e}>
                <button
                  type="button"
                  onClick={() => setDraft(e)}
                  className="w-full border border-rule px-3 py-2 text-left text-sm text-ink hover:border-stroke hover:bg-paper"
                >
                  {e}
                </button>
              </li>
            ))}
          </ul>
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
                  {m.plan ? (
                    <>
                      <PlanView plan={m.plan} />
                      {m.id !== null ? <SavePlan workspaceId={workspaceId} messageId={m.id} /> : null}
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
        className="flex flex-col gap-2 border border-ink bg-sheet p-3"
      >
        <label htmlFor="assistant-input" className="sr-only">
          Mensaje para el asistente
        </label>
        <textarea
          id="assistant-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send(draft)
            }
          }}
          rows={3}
          maxLength={4000}
          placeholder={messages.length ? "Pide cambios al plan o añade detalles…" : "Describe la tarea…"}
          className="w-full resize-y bg-transparent text-base text-ink placeholder:text-graphite/70 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-graphite">Intro para enviar, Mayús+Intro para nueva línea</span>
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="h-10 bg-stroke px-5 text-sm font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  )
}

function SavePlan({ workspaceId, messageId }: { workspaceId: string; messageId: number }) {
  return (
    <form action={saveFlowFromMessage}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="messageId" value={messageId} />
      <SaveButton />
    </form>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 border border-ink bg-sheet px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar como automatización (borrador)"}
    </button>
  )
}
