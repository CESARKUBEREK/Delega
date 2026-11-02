"use client"

// Conversación de voz en tiempo real con Grok Voice (xAI) desde el navegador:
// micrófono en PCM 16 bits a 24 kHz por WebSocket y reproducción de la voz que
// llega. Las herramientas que pida el agente las resuelve quien la usa
// (onTool). Es la misma mecánica que /hablar/<id> (asistente en la web del
// cliente). Nada de la conversación se guarda.

const RATE = 24000

export type VoicePhase = "connecting" | "live" | "ended"

export type VoiceStart = { token: string; model: string; max_minutes: number; session: Record<string, unknown> }

type Handlers = {
  onPhase: (phase: VoicePhase, note?: string) => void
  onSpeaking: (speaking: boolean) => void
  onSeconds: (seconds: number) => void
  onTool: (name: string, args: Record<string, unknown>) => Promise<string>
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

export async function requestMicrophone(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
  } catch {
    return null
  }
}

export class RealtimeVoice {
  private ws: WebSocket
  private ctx: AudioContext
  private processor: ScriptProcessorNode
  private playing: AudioBufferSourceNode[] = []
  private nextTime = 0
  private pendingTools = 0
  private timer = 0
  private closed = false

  constructor(
    private stream: MediaStream,
    start: VoiceStart,
    private h: Handlers,
  ) {
    this.ctx = new AudioContext({ sampleRate: RATE })
    const source = this.ctx.createMediaStreamSource(stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.ws = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(start.model)}`, [`xai-client-secret.${start.token}`])
    const limit = Math.max(1, start.max_minutes) * 60

    this.processor.onaudioprocess = (e) => {
      if (this.ws.readyState !== WebSocket.OPEN) return
      const input = e.inputBuffer.getChannelData(0)
      const pcm = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const v = Math.max(-1, Math.min(1, input[i]))
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff
      }
      this.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: toBase64(new Uint8Array(pcm.buffer)) }))
    }

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: "session.update", session: start.session }))
      this.ws.send(JSON.stringify({ type: "response.create" })) // que salude primero
      source.connect(this.processor)
      this.processor.connect(this.ctx.destination)
      h.onPhase("live")
      const startedAt = Date.now()
      this.timer = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000)
        h.onSeconds(s)
        if (s >= limit) this.stop("Se acabó el tiempo de esta conversación. Puedes empezar otra o escribirme.")
      }, 1000)
    }
    this.ws.onmessage = (ev) => {
      if (typeof ev.data !== "string") return
      let msg: { type?: string; delta?: string; call_id?: string; name?: string; arguments?: string; error?: { message?: string } }
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      if ((msg.type === "response.output_audio.delta" || msg.type === "response.audio.delta") && msg.delta) this.play(msg.delta)
      else if (msg.type === "input_audio_buffer.speech_started") this.stopPlayback()
      else if (msg.type === "response.function_call_arguments.done" && msg.call_id && msg.name) void this.runTool(msg.call_id, msg.name, msg.arguments ?? "{}")
      else if (msg.type === "error") console.warn("voz", msg.error?.message)
    }
    this.ws.onerror = () => this.stop("Se cortó la conexión. Inténtalo de nuevo.")
    this.ws.onclose = () => this.stop()
  }

  private stopPlayback() {
    for (const s of this.playing) {
      try {
        s.stop()
      } catch {
        // ya terminó
      }
    }
    this.playing = []
    this.nextTime = this.ctx.currentTime
    this.h.onSpeaking(false)
  }

  private play(b64: string) {
    const pcm = fromBase64(b64)
    if (!pcm.length || this.closed) return
    const buffer = this.ctx.createBuffer(1, pcm.length, RATE)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 0x8000
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.ctx.destination)
    const at = Math.max(this.ctx.currentTime, this.nextTime)
    src.start(at)
    this.nextTime = at + buffer.duration
    this.playing.push(src)
    this.h.onSpeaking(true)
    src.onended = () => {
      this.playing = this.playing.filter((x) => x !== src)
      if (!this.playing.length) this.h.onSpeaking(false)
    }
  }

  private async runTool(callId: string, name: string, raw: string) {
    this.pendingTools++
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(raw)
    } catch {
      args = {}
    }
    const output = await this.h.onTool(name, args).catch(() => "No se pudo hacer.")
    if (this.closed || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output } }))
    this.pendingTools--
    // Un solo response.create cuando han vuelto todas las herramientas pedidas.
    if (this.pendingTools <= 0) {
      this.pendingTools = 0
      this.ws.send(JSON.stringify({ type: "response.create" }))
    }
  }

  stop(note?: string) {
    if (this.closed) return
    this.closed = true
    window.clearInterval(this.timer)
    try {
      this.processor.disconnect()
    } catch {
      // ya desconectado
    }
    this.stream.getTracks().forEach((t) => t.stop())
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) this.ws.close()
    void this.ctx.close().catch(() => null)
    this.h.onSpeaking(false)
    this.h.onPhase("ended", note)
  }
}
