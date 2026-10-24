"use client"

import { useSyncExternalStore } from "react"

// Capacidades del dispositivo, leídas en el navegador. En el servidor (y en el
// primer render) devuelven "unknown" para no desajustar la hidratación.

export type DeviceInfo = {
  ios: boolean
  standalone: boolean
  push: boolean
  recording: boolean
  speech: boolean
}

let cached: DeviceInfo | null = null

function read(): DeviceInfo {
  if (cached) return cached
  const nav = navigator as Navigator & { standalone?: boolean }
  const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
  cached = {
    ios,
    standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    push: "serviceWorker" in nav && "PushManager" in window && "Notification" in window,
    recording: typeof MediaRecorder !== "undefined" && Boolean(nav.mediaDevices?.getUserMedia),
    speech: "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined",
  }
  return cached
}

const noop = () => () => {}

export function useDevice(): DeviceInfo | "unknown" {
  return useSyncExternalStore<DeviceInfo | "unknown">(noop, read, () => "unknown")
}

// Preferencias del dispositivo (no del espacio): se guardan en localStorage.
const listeners = new Set<() => void>()

export function getPref(key: string): string | null {
  try {
    return window.localStorage.getItem(`orkesta:${key}`)
  } catch {
    return null
  }
}

export function setPref(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(`orkesta:${key}`)
    else window.localStorage.setItem(`orkesta:${key}`, value)
  } catch {
    // modo privado o almacenamiento bloqueado: la preferencia dura la sesión
  }
  listeners.forEach((l) => l())
}

export function usePref(key: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => getPref(key),
    () => null,
  )
}
