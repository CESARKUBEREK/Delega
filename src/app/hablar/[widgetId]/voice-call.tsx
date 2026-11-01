"use client"

import { useEffect, useRef, useState } from "react"
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env"

// Conversación de voz con el agente de Grok (xAI) desde el navegador.
// 1. voice-web (Edge Function) da un token temporal de xAI y la configuración.
// 2. El navegador abre el WebSocket de xAI, envía el micrófono (PCM 16 bits,
//    24 kHz) y reproduce la voz que llega.
// 3. Cuando el agente pide una herramienta (huecos, cita, recado, documentos),
//    se la pedimos a voice-web y le devolvemos el resultado.
// Nada de la conversación se guarda en el navegador.

type Phase = "idle" | "connecting" | "live" | "ended" | "error"
type Start = {
  token: string
  model: string
  session_id: string
  session_secret: string
  max_minutes: number
  session: Record<string, unknown>
}

const RATE = 24000
const FN = `${supabaseUrl}/functions/v1/voice-web`

async function callFn<T>(body: unknown): Promise<T & { error?: { message: string } }> {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabasePublishableKey },
    body: JSON.stringify(body),
  })
  return (await r.json().catch(() => ({ error: { message: "No se pudo conectar. Inténtalo de nuevo." } }))) as T & { error?: { message: string } }
}

function toBase64(bytes: Uint8Array): string {
  let s = ""
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromBase64(b64: string): Int16Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2))
}

export function VoiceCall({ widgetId }: { widgetId: string }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [message, setMessage] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const live = useRef<{
    ws: WebSocket
    ctx: AudioContext
    stream: MediaStream
    processor: ScriptProcessorNode
    playing: AudioBufferSourceNode[]
    nextTime: number
    session: { id: string; secret: string }
    pendingTools: number
    timer: number
    limit: number
  } | null>(null)

  useEffect(() => () => hangUp(), [])

  function stopPlayback() {
    const l = live.current
    if (!l) return
    for (const s of l.playing) {
      try {
        s.stop()
      } catch {
        // ya terminó
      }
    }
    l.playing = []
    l.nextTime = l.ctx.currentTime
    setSpeaking(false)
  }

  function play(b64: string) {
    const l = live.current
    if (!l) return
    const pcm = fromBase64(b64)
    if (!pcm.length) return
    const buffer = l.ctx.createBuffer(1, pcm.length, RATE)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 0x8000
    const src = l.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(l.ctx.destination)
    const at = Math.max(l.ctx.currentTime, l.nextTime)
    src.start(at)
    l.nextTime = at + buffer.duration
    l.playing.push(src)
    setSpeaking(true)
    src.onended = () => {
      if (!live.current) return
      live.current.playing = live.current.playing.filter((x) => x !== src)
      if (!live.current.playing.length) setSpeaking(false)
    }
  }

  async function runTool(callId: string, name: string, args: string) {
    const l = live.current
    if (!l) return
    l.pendingTools++
    const r = await callFn<{ output?: string }>({ action: "tool", session_id: l.session.id, session_secret: l.session.secret, name, arguments: args }).catch(() => null)
    const output = r?.output ?? r?.error?.message ?? "No se pudo completar. Ofrece tomar un recado."
    const cur = live.current
    if (!cur || cur.ws.readyState !== WebSocket.OPEN) return
    cur.ws.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output } }))
    cur.pendingTools--
    // Un solo response.create cuando han vuelto todas las herramientas pedidas.
    if (cur.pendingTools <= 0) {
      cur.pendingTools = 0
      cur.ws.send(JSON.stringify({ type: "response.create" }))
    }
  }

  async function begin() {
    if (!widgetId) {
      setPhase("error")
      setMessage("Este asistente no existe.")
      return
    }
    setPhase("connecting")
    setMessage(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
    } catch {
      setPhase("error")
      setMessage("Necesitamos permiso para usar el micrófono. Actívalo en tu navegador y vuelve a intentarlo.")
      return
    }
    let parent = ""
    try {
      parent = window.location.ancestorOrigins?.[0] ?? document.referrer ?? ""
    } catch {
      parent = ""
    }
    const start = await callFn<Start>({ action: "start", widget: widgetId, parent }).catch(() => null)
    if (!start || start.error || !start.token) {
      stream.getTracks().forEach((t) => t.stop())
      setPhase("error")
      setMessage(start?.error?.message ?? "No se pudo conectar. Inténtalo de nuevo.")
      return
    }

    const ctx = new AudioContext({ sampleRate: RATE })
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const ws = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(start.model)}`, [`xai-client-secret.${start.token}`])
    live.current = {
      ws,
      ctx,
      stream,
      processor,
      playing: [],
      nextTime: 0,
      session: { id: start.session_id, secret: start.session_secret },
      pendingTools: 0,
      timer: 0,
      limit: Math.max(1, start.max_minutes) * 60,
    }

    processor.onaudioprocess = (e) => {
      const l = live.current
      if (!l || l.ws.readyState !== WebSocket.OPEN) return
      const input = e.inputBuffer.getChannelData(0)
      const pcm = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const v = Math.max(-1, Math.min(1, input[i]))
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff
      }
      l.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: toBase64(new Uint8Array(pcm.buffer)) }))
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "session.update", session: start.session }))
      // Que salude primero.
      ws.send(JSON.stringify({ type: "response.create" }))
      source.connect(processor)
      processor.connect(ctx.destination)
      setPhase("live")
      const startedAt = Date.now()
      const l = live.current
      if (l) {
        l.timer = window.setInterval(() => {
          const s = Math.floor((Date.now() - startedAt) / 1000)
          setSeconds(s)
          if (live.current && s >= live.current.limit) hangUp("Se acabó el tiempo de esta conversación. Si necesitas algo más, vuelve a empezar o escríbenos.")
        }, 1000)
      }
    }
    ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return
      let msg: { type?: string; delta?: string; call_id?: string; name?: string; arguments?: string; error?: { message?: string } }
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      if ((msg.type === "response.output_audio.delta" || msg.type === "response.audio.delta") && msg.delta) play(msg.delta)
      else if (msg.type === "input_audio_buffer.speech_started") stopPlayback()
      else if (msg.type === "response.function_call_arguments.done" && msg.call_id && msg.name) void runTool(msg.call_id, msg.name, msg.arguments ?? "{}")
      else if (msg.type === "error") console.warn("voz", msg.error?.message)
    }
    ws.onerror = () => hangUp("Se cortó la conexión. Inténtalo de nuevo.")
    ws.onclose = () => {
      if (live.current) hangUp()
    }
  }

  function hangUp(note?: string) {
    const l = live.current
    live.current = null
    if (!l) return
    window.clearInterval(l.timer)
    try {
      l.processor.disconnect()
    } catch {
      // ya desconectado
    }
    l.stream.getTracks().forEach((t) => t.stop())
    if (l.ws.readyState === WebSocket.OPEN || l.ws.readyState === WebSocket.CONNECTING) l.ws.close()
    void l.ctx.close().catch(() => null)
    void callFn({ action: "end", session_id: l.session.id, session_secret: l.session.secret }).catch(() => null)
    setSpeaking(false)
    setPhase(note ? "error" : "ended")
    setMessage(note ?? "Conversación terminada. ¡Gracias!")
  }

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <div className={`voice-orb ${phase === "live" ? (speaking ? "is-speaking" : "is-listening") : ""}`} aria-hidden="true" />
      <p className="text-lg font-semibold text-ink" role="status" aria-live="polite">
        {phase === "idle"
          ? "Habla con nosotros"
          : phase === "connecting"
            ? "Conectando…"
            : phase === "live"
              ? speaking
                ? "Te está respondiendo…"
                : "Te escucho. Habla cuando quieras."
              : (message ?? "")}
      </p>
      {phase === "live" ? <p className="text-sm text-graphite">{mm}</p> : null}
      {phase === "live" || phase === "connecting" ? (
        <button type="button" onClick={() => hangUp()} className="h-12 w-full rounded-full bg-alert px-6 text-base font-semibold text-white">
          Colgar
        </button>
      ) : (
        <button type="button" onClick={() => void begin()} className="h-12 w-full rounded-full bg-stroke px-6 text-base font-semibold text-stroke-ink">
          {phase === "idle" ? "Empezar a hablar" : "Volver a empezar"}
        </button>
      )}
      <p className="text-xs text-graphite">
        Hablas con un asistente de voz con IA. Puede pedir cita y tomar recados para el negocio. No compartas datos de salud ni bancarios.
      </p>
    </div>
  )
}
