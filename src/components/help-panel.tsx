"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { applyStepChanges, askHelp, helpVoiceAvailable, startHelpVoice, type HelpTurn, type StepChange } from "@/app/w/[workspaceId]/help-actions"
import { AutoReadToggle, DictateButton, ListenButton, useAutoRead } from "@/app/w/[workspaceId]/asistente/voice"
import { HELP_GUIDES, looksLikeSecret, relevantGuides, SECRET_REPLY, type HelpGuide } from "@/lib/help"
import { RealtimeVoice, requestMicrophone, type VoicePhase } from "@/lib/realtime-voice"
import { InfoBanner } from "@/components/ui"
import { speak, stopSpeaking, unlockSpeech } from "@/lib/speech"

// Panel «¿Te ayudo?» (fase 7-1): dudas sobre integraciones y automatizaciones.
// Responde con el estado del espacio y las fichas de ayuda; puede abrir la
// tarjeta de una integración. La conversación vive solo en esta pestaña y las
// claves que se peguen no salen del navegador.

type Page = "integraciones" | "automatizaciones" | "onboarding" | "ejecucion"
type Message = HelpTurn & {
  // Clave para «Escuchar» (solo respuestas del ayudante).
  key?: string
  open?: string | null
  suggestions?: string[]
  trial?: boolean
  stepChanges?: StepChange[]
  flowId?: string | null
  applied?: "ok" | string
}

// Abre el panel y pregunta (por ejemplo, desde «Por qué falló» en una ejecución).
export const HELP_ASK_EVENT = "marchasolo:help-ask"
export function askHelpPanel(question: string) {
  window.dispatchEvent(new CustomEvent(HELP_ASK_EVENT, { detail: { question } }))
}

const STARTERS: Record<Page, string[]> = {
  integraciones: ["¿Por dónde empiezo?", "¿Cómo conecto mi correo de Gmail?", "¿Qué IA me conviene?"],
  automatizaciones: ["¿Cómo creo mi primera automatización?", "¿Cómo hago que se ejecute sola cada día?", "Mi automatización falló, ¿qué hago?"],
  onboarding: ["¿Qué necesito para empezar?", "¿Es seguro conectar mi correo?", "¿Se envía algo sin que yo lo vea?"],
  ejecucion: ["¿Por qué falló esta ejecución?", "¿Qué hace cada paso?", "¿Cómo evito que vuelva a pasar?"],
}

const guideById = (id: string | null | undefined) => (id ? HELP_GUIDES.find((g) => g.id === id) : undefined)

// Abre, enseña y resalta la tarjeta de una integración. Si no está en esta
// página, lleva a Integraciones con ?abrir=.
export function openHelpCard(id: string): boolean {
  const el = document.querySelector<HTMLDetailsElement>(`details[data-help="${CSS.escape(id)}"]`)
  if (!el) return false
  el.open = true
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  el.classList.add("help-highlight")
  window.setTimeout(() => el.classList.remove("help-highlight"), 2600)
  return true
}

export function HelpPanel({ workspaceId, page, runId = null }: { workspaceId: string; page: Page; runId?: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [noAi, setNoAi] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [applying, startApply] = useTransition()
  // Dictado y lectura en voz alta (fase 7-3): los mismos que el chat. La
  // preferencia «leer en voz alta» es la del dispositivo, compartida con el chat.
  const autoRead = useAutoRead()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // La última tarjeta que se abrió en la página es el contexto de la pregunta.
  useEffect(() => {
    const onToggle = (e: Event) => {
      const el = e.target as HTMLElement | null
      if (el instanceof HTMLDetailsElement && el.open && el.dataset.help) setFocus(el.dataset.help)
    }
    document.addEventListener("toggle", onToggle, true)
    return () => document.removeEventListener("toggle", onToggle, true)
  }, [])

  useEffect(() => {
    if (!open) {
      stopSpeaking()
      return
    }
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, pending])

  const goToCard = (id: string) => {
    if (openHelpCard(id)) {
      if (window.matchMedia("(max-width: 1023px)").matches) setOpen(false)
      return
    }
    const g = guideById(id)
    router.push(`/w/${workspaceId}/integraciones?abrir=${encodeURIComponent(id)}${g ? `#${g.section}` : ""}`)
  }

  const send = (text: string) => {
    const message = text.trim()
    if (!message || pending) return
    setError(null)
    setInput("")
    // iOS solo deja hablar tras un gesto: se desbloquea la voz al enviar.
    if (autoRead) unlockSpeech()
    // Una clave pegada no sale del navegador.
    if (looksLikeSecret(message)) {
      const guess = relevantGuides(message, focus)[0]?.id ?? focus
      setMessages((m) => [
        ...m,
        { role: "user", content: "(He borrado tu mensaje: parecía una clave o una contraseña)" },
        { role: "assistant", content: SECRET_REPLY, open: guess, key: `ayuda-${Date.now()}` },
      ])
      return
    }
    const history: HelpTurn[] = messages.map(({ role, content }) => ({ role, content }))
    setMessages((m) => [...m, { role: "user", content: message }])
    startTransition(async () => {
      const r = await askHelp({ workspaceId, page, focus, runId, history, message }).catch(() => null)
      if (!r) {
        setError("No se pudo contactar con el ayudante. Inténtalo de nuevo.")
        return
      }
      if (!r.ok) {
        if (r.code === "no_connection") setNoAi(r.error)
        else setError(r.error)
        return
      }
      const key = `ayuda-${Date.now()}`
      setMessages((m) => [
        ...m,
        { role: "assistant", content: r.reply, key, open: r.open, suggestions: r.suggestions, trial: r.trial, stepChanges: r.stepChanges, flowId: r.flowId },
      ])
      if (autoRead) speak(key, r.reply)
    })
  }

  // Preguntas que llegan de otros botones de la página.
  const sendRef = useRef(send)
  useEffect(() => {
    sendRef.current = send
  })
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<{ question?: string }>).detail?.question
      setOpen(true)
      if (q) window.setTimeout(() => sendRef.current(q), 0)
    }
    window.addEventListener(HELP_ASK_EVENT, onAsk)
    return () => window.removeEventListener(HELP_ASK_EVENT, onAsk)
  }, [])

  const apply = (index: number) => {
    const m = messages[index]
    if (!m?.flowId || !m.stepChanges?.length) return
    startApply(async () => {
      const r = await applyStepChanges({ workspaceId, flowId: m.flowId as string, changes: m.stepChanges as StepChange[] }).catch(() => null)
      setMessages((all) => all.map((x, i) => (i === index ? { ...x, applied: r?.ok ? "ok" : (r && !r.ok ? r.error : "No se pudo guardar el cambio.") } : x)))
    })
  }

  const focusGuide = guideById(focus)
  const starters = focusGuide ? [`¿Cómo conecto ${focusGuide.title}?`, ...STARTERS[page].slice(0, 2)] : STARTERS[page]
  const last = messages[messages.length - 1]
  const followUps = last?.role === "assistant" ? (last.suggestions ?? []) : []

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="help-panel"
        className="help-fab fixed right-4 bottom-24 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-paper shadow-lg lg:bottom-6"
      >
        <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-stroke text-xs font-bold text-stroke-ink">
          ?
        </span>
        {open ? "Cerrar la ayuda" : "¿Te ayudo?"}
      </button>

      {open ? (
        <section
          id="help-panel"
          role="dialog"
          aria-label="Ayuda de MarchaSolo"
          className="help-panel fixed inset-x-3 bottom-40 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-rule bg-sheet shadow-xl sm:inset-x-auto sm:right-4 sm:w-[24rem] lg:bottom-20"
        >
          <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
            <div>
              <p className="font-semibold text-ink">¿Te ayudo?</p>
              <p className="text-xs text-graphite">
                Escríbeme o díctame tu duda sobre conectar cuentas y crear automatizaciones. Nunca me digas claves ni contraseñas.
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-graphite" aria-label="Cerrar">
              ✕
            </button>
          </header>

          <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {noAi ? (
              <NoAiHelp message={noAi} page={page} base={`/w/${workspaceId}`} onOpenCard={goToCard} />
            ) : (
              <>
                {messages.length === 0 ? (
                  <p className="text-sm text-graphite">
                    Pregúntame lo que quieras sobre{" "}
                    {page === "ejecucion" ? "esta ejecución" : page === "automatizaciones" ? "tus automatizaciones" : "tus integraciones"}.
                    {focusGuide ? ` Veo que estás con ${focusGuide.title}.` : ""}
                  </p>
                ) : null}
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <p key={i} className="ml-8 rounded-xl bg-paper px-3 py-2 text-sm text-ink">
                      {m.content}
                    </p>
                  ) : (
                    <div key={i} className="mr-4 flex flex-col gap-2">
                      <p className="whitespace-pre-wrap text-sm text-ink">{m.content}</p>
                      {m.key ? (
                        <div className="text-xs">
                          <ListenButton id={m.key} text={m.content} />
                        </div>
                      ) : null}
                      {m.open && guideById(m.open) ? (
                        <button
                          type="button"
                          onClick={() => goToCard(m.open as string)}
                          className="self-start rounded-lg border border-stroke px-3 py-1.5 text-sm font-semibold text-ink"
                        >
                          Abrir la tarjeta de {guideById(m.open)?.title} →
                        </button>
                      ) : null}
                      {m.stepChanges?.length && m.flowId ? (
                        <div className="rounded-xl border border-rule bg-paper p-3 text-sm">
                          <p className="font-semibold text-ink">Cambios propuestos en la automatización</p>
                          <ul className="mt-1 flex flex-col gap-1 text-graphite">
                            {m.stepChanges.map((c) => (
                              <li key={c.step}>
                                <strong className="text-ink">Paso {c.step}:</strong> {c.description}
                              </li>
                            ))}
                          </ul>
                          {m.applied === "ok" ? (
                            <p className="mt-2 font-semibold text-ok" role="status">
                              ✓ Guardado.{" "}
                              <Link href={`/w/${workspaceId}/automatizaciones/${m.flowId}`} className="text-link underline underline-offset-4">
                                Ver la automatización
                              </Link>
                            </p>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => apply(i)}
                                disabled={applying}
                                className="mt-2 rounded-lg bg-stroke px-3 py-1.5 font-semibold text-stroke-ink disabled:opacity-60"
                              >
                                {applying ? "Guardando…" : "Aplicar el cambio"}
                              </button>
                              {m.applied ? <p className="mt-1 text-alert">{m.applied}</p> : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
                {pending ? (
                  <p className="flex items-center gap-2 text-sm text-graphite" role="status">
                    <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-stroke" /> Pensando…
                  </p>
                ) : null}
                {error ? (
                  <InfoBanner tone="danger" role="alert">
                    {error}
                  </InfoBanner>
                ) : null}
              </>
            )}
          </div>

          <VoiceSection workspaceId={workspaceId} page={page} onCardElsewhere={goToCard} />

          {!noAi ? (
            <div className="flex flex-col gap-2 border-t border-rule px-4 py-3">
              {!pending && (messages.length === 0 || followUps.length > 0) ? (
                <div className="flex flex-wrap gap-1.5">
                  {(messages.length === 0 ? starters : followUps).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-rule px-2.5 py-1 text-xs text-graphite hover:border-ink hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(input)
                }}
                className="flex items-end gap-2"
              >
                <DictateButton
                  workspaceId={workspaceId}
                  disabled={pending}
                  onError={setError}
                  onText={(text) => {
                    setInput((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text))
                    inputRef.current?.focus()
                  }}
                />
                <label htmlFor="help-input" className="sr-only">
                  Tu pregunta
                </label>
                <textarea
                  id="help-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Escribe tu pregunta…"
                  className="min-h-11 flex-1 resize-none rounded-xl border border-rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-graphite focus:border-stroke focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={pending || !input.trim()}
                  className="h-11 rounded-xl bg-stroke px-4 text-sm font-semibold text-stroke-ink disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
              <AutoReadToggle />
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

// Sin IA ni créditos: las fichas como preguntas frecuentes.
function NoAiHelp({ message, page, base, onOpenCard }: { message: string; page: Page; base: string; onOpenCard: (id: string) => void }) {
  const first: HelpGuide[] =
    page === "automatizaciones" || page === "ejecucion" ? HELP_GUIDES.filter((g) => g.id === "automatizaciones") : HELP_GUIDES.filter((g) => g.section === "llms")
  const rest = HELP_GUIDES.filter((g) => !first.includes(g))
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-ink">
        Para responderte necesito una IA conectada. {message} Mientras tanto, aquí tienes las guías:
      </p>
      {[...first, ...rest].map((g) => (
        <details key={g.id} className="rounded-xl border border-rule bg-paper px-3 py-2">
          <summary className="cursor-pointer font-semibold text-ink">{g.title}</summary>
          <p className="mt-1 text-graphite">{g.summary}</p>
          <ol className="mt-2 list-decimal pl-5 text-graphite">
            {g.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {g.errors.map((e) => (
            <p key={e.q} className="mt-2 text-graphite">
              <strong className="text-ink">{e.q}.</strong> {e.a}
            </p>
          ))}
          {g.section !== "automatizaciones" ? (
            <button type="button" onClick={() => onOpenCard(g.id)} className="mt-2 font-semibold text-link underline underline-offset-4">
              Abrir la tarjeta →
            </button>
          ) : (
            <Link href={`${base}/asistente`} className="mt-2 inline-block font-semibold text-link underline underline-offset-4">
              Ir al chat →
            </Link>
          )}
        </details>
      ))}
    </div>
  )
}

// En Integraciones: abre la tarjeta de ?abrir=<id> al llegar.
export function OpenCardFromQuery() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("abrir")
    if (!id) return
    const t = window.setTimeout(() => openHelpCard(id), 300)
    return () => window.clearTimeout(t)
  }, [])
  return null
}

// Conversación por voz en tiempo real con el ayudante (fase 7-4). Opcional:
// solo si un administrador la activó y hay clave de xAI. El agente solo puede
// abrir tarjetas; si la tarjeta no está en esta página, deja un botón.
function VoiceSection({ workspaceId, page, onCardElsewhere }: { workspaceId: string; page: Page; onCardElsewhere: (id: string) => void }) {
  const [available, setAvailable] = useState<{ enabled: boolean; xai: boolean; isAdmin: boolean } | null>(null)
  const [phase, setPhase] = useState<VoicePhase | "idle">("idle")
  const [speaking, setSpeaking] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [note, setNote] = useState<string | null>(null)
  const [elsewhere, setElsewhere] = useState<string | null>(null)
  const session = useRef<RealtimeVoice | null>(null)

  useEffect(() => {
    let alive = true
    helpVoiceAvailable(workspaceId)
      .then((a) => alive && setAvailable(a))
      .catch(() => null)
    return () => {
      alive = false
      session.current?.stop()
    }
  }, [workspaceId])

  if (!available) return null
  if (!available.enabled) {
    return available.isAdmin ? (
      <p className="border-t border-rule px-4 py-2 text-xs text-graphite">
        ¿Prefieres hablar?{" "}
        <a href={`/w/${workspaceId}/integraciones?abrir=voice-app#asistente-voz`} className="font-semibold text-link underline underline-offset-4">
          Activa la conversación por voz
        </a>
      </p>
    ) : null
  }
  if (!available.xai) {
    return <p className="border-t border-rule px-4 py-2 text-xs text-graphite">Para hablar conmigo por voz hace falta conectar Grok (xAI) en Integraciones → LLMs.</p>
  }

  const start = async () => {
    stopSpeaking()
    setNote(null)
    setElsewhere(null)
    setPhase("connecting")
    const stream = await requestMicrophone()
    if (!stream) {
      setPhase("idle")
      setNote("Necesito permiso para usar el micrófono. Actívalo en el navegador.")
      return
    }
    const r = await startHelpVoice({ workspaceId, page }).catch(() => null)
    if (!r || !r.ok) {
      stream.getTracks().forEach((t) => t.stop())
      setPhase("idle")
      setNote(r && !r.ok ? r.error : "No se pudo conectar. Inténtalo de nuevo.")
      return
    }
    setSeconds(0)
    session.current = new RealtimeVoice(stream, r, {
      onPhase: (p, n) => {
        setPhase(p)
        if (p === "ended") {
          session.current = null
          setNote(n ?? null)
        }
      },
      onSpeaking: setSpeaking,
      onSeconds: setSeconds,
      onTool: async (name, args) => {
        const id = typeof args.id === "string" ? args.id : ""
        if (name !== "open_card" || !guideById(id)) return "No existe esa tarjeta."
        if (openHelpCard(id)) return "Tarjeta abierta en pantalla."
        setElsewhere(id)
        return "La tarjeta está en la página de Integraciones: dile que pulse el botón «Abrir la tarjeta» del panel."
      },
    })
  }

  const live = phase === "live" || phase === "connecting"
  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  return (
    <div className="flex flex-col gap-2 border-t border-rule px-4 py-2">
      {live ? (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className={`h-3 w-3 rounded-full ${speaking ? "animate-pulse bg-stroke" : "bg-ok"}`} />
          <p className="flex-1 text-sm text-ink" role="status" aria-live="polite">
            {phase === "connecting" ? "Conectando…" : speaking ? "Te estoy respondiendo…" : "Te escucho. Habla cuando quieras."}{" "}
            <span className="text-xs text-graphite">{phase === "live" ? mm : ""}</span>
          </p>
          <button type="button" onClick={() => session.current?.stop()} className="h-9 rounded-full bg-alert px-4 text-sm font-semibold text-white">
            Colgar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => void start()} className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-ink px-4 text-sm font-semibold text-ink">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
          </svg>
          Hablar con el ayudante
        </button>
      )}
      {elsewhere && guideById(elsewhere) ? (
        <button type="button" onClick={() => onCardElsewhere(elsewhere)} className="self-start text-sm font-semibold text-link underline underline-offset-4">
          Abrir la tarjeta de {guideById(elsewhere)?.title} →
        </button>
      ) : null}
      {note ? <p className="text-xs text-graphite">{note}</p> : null}
      {!live ? <p className="text-[11px] text-graphite">Usa tu clave de Grok (xAI). Por voz no se aprueba nada ni se dicen claves.</p> : null}
    </div>
  )
}
