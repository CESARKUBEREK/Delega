"use client"

// Lectura en voz alta con la voz del propio dispositivo (gratis, sin enviar
// nada a ningún servidor). Elige una voz en español si la hay.

const listeners = new Set<() => void>()
let speakingKey: string | null = null

function notify() {
  listeners.forEach((l) => l())
}

export function subscribeSpeech(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function currentSpeech(): string | null {
  return speakingKey
}

function spanishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === "es-ES" && v.localService) ??
    voices.find((v) => v.lang.startsWith("es") && v.localService) ??
    voices.find((v) => v.lang.startsWith("es"))
  )
}

// Quita marcas que no se deben leer (viñetas, comillas angulares, URLs).
function clean(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "enlace")
    .replace(/[«»*_#`>]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .slice(0, 3000)
}

export function speak(key: string, text: string) {
  if (!("speechSynthesis" in window)) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(clean(text))
  utterance.lang = "es-ES"
  const voice = spanishVoice()
  if (voice) utterance.voice = voice
  utterance.onend = utterance.onerror = () => {
    if (speakingKey === key) {
      speakingKey = null
      notify()
    }
  }
  speakingKey = key
  notify()
  synth.speak(utterance)
}

export function stopSpeaking() {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  speakingKey = null
  notify()
}

// iOS solo deja hablar después de un gesto del usuario: se "desbloquea" la voz
// en el toque de Enviar para poder leer la respuesta cuando llegue.
export function unlockSpeech() {
  if (!("speechSynthesis" in window)) return
  const u = new SpeechSynthesisUtterance("")
  u.volume = 0
  window.speechSynthesis.speak(u)
}
