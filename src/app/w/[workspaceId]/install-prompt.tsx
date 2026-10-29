"use client"

import { useSyncExternalStore } from "react"
import { setPref, useDevice, usePref } from "@/lib/device"

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// Android y Chrome avisan de que la app se puede instalar con el evento
// beforeinstallprompt, que puede llegar antes de que se monte el componente.
let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener("appinstalled", () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

function useInstallEvent() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => deferred,
    () => null,
  )
}

// Aviso discreto, solo en el móvil, para instalar Marcha Solo en la pantalla de inicio.
export function InstallPrompt() {
  const device = useDevice()
  const event = useInstallEvent()
  const dismissed = usePref("install-dismissed")

  if (device === "unknown" || device.standalone || dismissed) return null
  const iosHint = device.ios && !event
  if (!event && !iosHint) return null

  return (
    <div className="mb-4 flex items-start gap-3 border border-ink bg-sheet px-4 py-3 lg:hidden" role="note">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-ink">Instala Marcha Solo en tu móvil</p>
        <p className="mt-0.5 text-graphite">
          {iosHint
            ? "Toca Compartir y luego «Añadir a pantalla de inicio». Así se abre como una app y puede avisarte."
            : "Ábrela como una app, a pantalla completa, y recibe avisos de lo que necesita tu aprobación."}
        </p>
        {event ? (
          <button
            type="button"
            onClick={async () => {
              await event.prompt()
              const choice = await event.userChoice.catch(() => null)
              if (choice?.outcome === "accepted") {
                deferred = null
                listeners.forEach((l) => l())
              }
            }}
            className="mt-2 h-9 bg-stroke px-4 text-sm font-semibold text-stroke-ink hover:opacity-90"
          >
            Instalar
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setPref("install-dismissed", "1")}
        className="shrink-0 px-1 text-sm text-graphite underline underline-offset-4"
      >
        Ahora no
      </button>
    </div>
  )
}
