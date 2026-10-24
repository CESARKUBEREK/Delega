"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { setPref, useDevice, usePref } from "@/lib/device"
import { currentSpeech, speak, stopSpeaking, subscribeSpeech } from "@/lib/speech"

const MAX_SECONDS = 120
// Formatos que transcribe OpenAI, por orden de preferencia.
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]

type State = { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "uploading" }

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  )
}

// Botón de dictado: graba hasta 2 minutos, envía el audio para transcribirlo y
// devuelve el texto, que el usuario revisa antes de enviarlo.
export function DictateButton({
  workspaceId,
  onText,
  onError,
  disabled,
}: {
  workspaceId: string
  onText: (text: string) => void
  onError: (message: string | null) => void
  disabled?: boolean
}) {
  const device = useDevice()
  const [state, setState] = useState<State>({ kind: "idle" })
  const setError = onError
  const recorder = useRef<MediaRecorder | null>(null)
  const timers = useRef<{ tick?: ReturnType<typeof setInterval>; limit?: ReturnType<typeof setTimeout> }>({})

  useEffect(() => {
    const t = timers.current
    return () => {
      clearInterval(t.tick)
      clearTimeout(t.limit)
      if (recorder.current?.state === "recording") recorder.current.stop()
    }
  }, [])

  if (device === "unknown" || !device.recording) return null

  async function upload(blob: Blob, seconds: number) {
    setState({ kind: "uploading" })
    const ext = blob.type.includes("mp4") ? "mp4" : "webm"
    const form = new FormData()
    form.set("audio", blob, `dictado.${ext}`)
    form.set("seconds", String(Math.round(seconds)))
    try {
      const res = await fetch(`/w/${workspaceId}/voz`, { method: "POST", body: form })
      const data = (await res.json().catch(() => null)) as { text?: string; error?: { message?: string } } | null
      if (!res.ok || !data?.text) {
        setError(data?.error?.message ?? (data?.text === "" ? "No se entendió nada en la grabación." : "No se pudo transcribir el dictado."))
      } else {
        onText(data.text)
      }
    } catch {
      setError("No se pudo enviar la grabación. Revisa la conexión.")
    }
    setState({ kind: "idle" })
  }

  async function startRecording() {
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      setError("No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador.")
      return
    }
    const mimeType = MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined)
    const chunks: Blob[] = []
    const started = Date.now()
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    rec.onstop = () => {
      clearInterval(timers.current.tick)
      clearTimeout(timers.current.limit)
      stream.getTracks().forEach((t) => t.stop())
      const seconds = (Date.now() - started) / 1000
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" })
      if (seconds < 0.8 || blob.size === 0) {
        setState({ kind: "idle" })
        setError("La grabación es demasiado corta. Toca el micrófono, habla y vuelve a tocarlo.")
        return
      }
      void upload(blob, seconds)
    }
    recorder.current = rec
    rec.start(1000)
    setState({ kind: "recording", seconds: 0 })
    timers.current.tick = setInterval(() => setState({ kind: "recording", seconds: Math.round((Date.now() - started) / 1000) }), 500)
    timers.current.limit = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000)
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop()
  }

  const recording = state.kind === "recording"
  const mm = recording ? `${Math.floor(state.seconds / 60)}:${String(state.seconds % 60).padStart(2, "0")}` : ""

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={disabled || state.kind === "uploading"}
      aria-pressed={recording}
      aria-label={recording ? "Detener el dictado" : state.kind === "uploading" ? "Transcribiendo" : "Dictar por voz"}
      className={`inline-flex h-10 shrink-0 items-center gap-1.5 border px-2.5 text-sm font-medium disabled:opacity-50 ${
        recording ? "border-alert bg-alert-bg text-alert" : "border-ink bg-sheet text-ink hover:bg-paper"
      }`}
    >
      <MicIcon />
      {recording ? `Parar ${mm}` : state.kind === "uploading" ? "…" : null}
    </button>
  )
}

function useSpeaking() {
  return useSyncExternalStore(subscribeSpeech, currentSpeech, () => null)
}

// «Escuchar»: lee un texto con la voz del dispositivo.
export function ListenButton({ id, text }: { id: string; text: string }) {
  const device = useDevice()
  const speaking = useSpeaking()
  if (device === "unknown" || !device.speech || !text.trim()) return null
  const active = speaking === id
  return (
    <button
      type="button"
      onClick={() => (active ? stopSpeaking() : speak(id, text))}
      aria-pressed={active}
      className="text-sm text-link underline underline-offset-4"
    >
      {active ? "Parar" : "Escuchar"}
    </button>
  )
}

// Preferencia de este dispositivo: leer en voz alta las respuestas nuevas.
export function useAutoRead(): boolean {
  return usePref("auto-read") === "1"
}

export function AutoReadToggle() {
  const device = useDevice()
  const on = useAutoRead()
  if (device === "unknown" || !device.speech) return null
  return (
    <label className="flex items-center gap-2 text-xs text-graphite">
      <input type="checkbox" checked={on} onChange={(e) => setPref("auto-read", e.target.checked ? "1" : null)} />
      Leer las respuestas en voz alta
    </label>
  )
}
