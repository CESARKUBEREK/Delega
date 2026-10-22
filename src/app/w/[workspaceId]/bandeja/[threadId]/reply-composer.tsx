"use client"

import { useState, useTransition } from "react"
import { draftReply, sendReply } from "../../run-actions"

const field = "border border-rule bg-sheet px-3 py-2 text-sm text-ink focus:border-link focus:outline-none"

// Redactar con IA → revisar y editar → enviar. Nada sale sin pulsar «Enviar».
export function ReplyComposer({ workspaceId, threadId, channel, to }: { workspaceId: string; threadId: string; channel: string; to: string }) {
  const [hint, setHint] = useState("")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [drafting, startDraft] = useTransition()
  const [sending, startSend] = useTransition()

  return (
    <section className="border border-ink bg-sheet p-4" aria-labelledby="reply-title">
      <h2 id="reply-title" className="rotulo text-lg">
        Responder
      </h2>
      <p className="mt-1 text-xs text-graphite">
        {channel === "email" ? `Por correo a ${to}, en el mismo hilo.` : `Por Telegram, desde tu bot, a ${to}.`}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="reply-hint" className="sr-only">
          Qué quieres responder
        </label>
        <input
          id="reply-hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={1000}
          placeholder="Opcional: qué quieres decir (p. ej. «confirmo la visita el jueves»)"
          className={`${field} h-10 min-w-0 flex-1`}
        />
        <button
          type="button"
          disabled={drafting || sending}
          onClick={() =>
            startDraft(async () => {
              setError(null)
              setSent(false)
              const r = await draftReply(workspaceId, threadId, hint)
              if (r.ok) setText(r.text)
              else setError(r.error)
            })
          }
          className="h-10 border border-ink px-4 text-sm text-ink hover:bg-paper disabled:opacity-60"
        >
          {drafting ? "Redactando…" : "Redactar con IA"}
        </button>
      </div>

      <label htmlFor="reply-text" className="mt-3 block text-sm font-medium text-ink">
        Texto que se enviará
      </label>
      <textarea
        id="reply-text"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSent(false)
        }}
        rows={8}
        maxLength={8000}
        className={`${field} mt-1 w-full`}
      />
      {error ? (
        <p role="alert" className="mt-2 border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p role="status" className="mt-2 border-l-2 border-ok bg-ok-bg px-3 py-2 text-sm text-ok">
          Enviado.
        </p>
      ) : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={sending || drafting || !text.trim()}
          onClick={() => {
            if (!window.confirm(channel === "email" ? `¿Enviar este correo a ${to}?` : `¿Enviar este mensaje por Telegram a ${to}?`)) return
            startSend(async () => {
              setError(null)
              const r = await sendReply(workspaceId, threadId, text)
              if (r.ok) {
                setText("")
                setHint("")
                setSent(true)
              } else setError(r.error)
            })
          }}
          className="h-10 bg-stroke px-5 text-sm font-semibold text-stroke-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </section>
  )
}
