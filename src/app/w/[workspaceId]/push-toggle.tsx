"use client"

import { useEffect, useState, useTransition } from "react"
import { useDevice } from "@/lib/device"
import { removePushSubscription, savePushSubscription, sendTestPush } from "./run-actions"

type Status = "checking" | "on" | "off"

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
  return navigator.serviceWorker.ready
}

async function save(sub: PushSubscription) {
  const keys = sub.toJSON().keys ?? {}
  return savePushSubscription({
    endpoint: sub.endpoint,
    p256dh: keys.p256dh ?? "",
    auth: keys.auth ?? "",
    userAgent: navigator.userAgent,
  })
}

// Activa o desactiva los avisos de aprobación en ESTE dispositivo.
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const device = useDevice()
  const [status, setStatus] = useState<Status>("checking")
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, start] = useTransition()

  useEffect(() => {
    if (device === "unknown" || !device.push) return
    let alive = true
    navigator.serviceWorker
      .getRegistration("/")
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then(async (sub) => {
        if (!alive) return
        setStatus(sub ? "on" : "off")
        // Vuelve a asociar el dispositivo a esta cuenta (por si cambió de usuario).
        if (sub) await save(sub)
      })
      .catch(() => alive && setStatus("off"))
    return () => {
      alive = false
    }
  }, [device])

  if (device === "unknown") return <p className="text-sm text-graphite">Comprobando este dispositivo…</p>
  if (!vapidPublicKey) return <p className="text-sm text-graphite">Los avisos aún no están configurados en el servidor.</p>
  if (!device.push) {
    return (
      <p className="text-sm text-graphite">
        {device.ios && !device.standalone
          ? "En iPhone y iPad los avisos solo funcionan con Marcha Solo instalada: toca Compartir y luego «Añadir a pantalla de inicio», y abre la app desde ese icono."
          : "Este navegador no admite avisos."}
      </p>
    )
  }

  function enable() {
    setMessage(null)
    start(async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== "granted") {
          setMessage({ ok: false, text: "No diste permiso para mostrar avisos. Puedes cambiarlo en los ajustes del navegador." })
          return
        }
        const reg = await registration()
        const options = { userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey!) }
        let sub: PushSubscription
        try {
          sub = await reg.pushManager.subscribe(options)
        } catch {
          // Suscripción anterior con otra clave: se renueva.
          await (await reg.pushManager.getSubscription())?.unsubscribe()
          sub = await reg.pushManager.subscribe(options)
        }
        const result = await save(sub)
        if (!result.ok) {
          await sub.unsubscribe()
          setMessage({ ok: false, text: result.error })
          return
        }
        setStatus("on")
        setMessage({ ok: true, text: "Avisos activados en este dispositivo." })
      } catch {
        setMessage({ ok: false, text: "No se pudieron activar los avisos en este dispositivo." })
      }
    })
  }

  function disable() {
    setMessage(null)
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/")
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe().catch(() => false)
      }
      setStatus("off")
      setMessage({ ok: true, text: "Avisos desactivados en este dispositivo." })
    })
  }

  function test() {
    setMessage(null)
    start(async () => {
      const result = await sendTestPush()
      setMessage(result.ok ? { ok: true, text: "Aviso enviado. Debería llegarte en unos segundos." } : { ok: false, text: result.error })
    })
  }

  const denied = typeof Notification !== "undefined" && Notification.permission === "denied"

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-graphite">
        {status === "on"
          ? "Activados: te avisaremos en este dispositivo cuando una tarea necesite tu aprobación."
          : "Recibe un aviso en este dispositivo cuando una tarea necesite tu aprobación. El aviso no muestra datos de tus clientes."}
      </p>
      {denied && status !== "on" ? (
        <p className="text-sm text-alert">Los avisos están bloqueados para Marcha Solo en este navegador. Desbloquéalos en sus ajustes.</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {status === "on" ? (
          <>
            <button
              type="button"
              onClick={test}
              disabled={busy}
              className="h-10 border border-ink bg-sheet px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
            >
              Enviar un aviso de prueba
            </button>
            <button type="button" onClick={disable} disabled={busy} className="text-sm text-alert underline underline-offset-4 disabled:opacity-60">
              Desactivar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy || status === "checking" || denied}
            className="h-10 bg-stroke px-4 text-sm font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Activando…" : "Activar avisos"}
          </button>
        )}
      </div>
      {message ? (
        <p role="status" className={`text-sm ${message.ok ? "text-ok" : "text-alert"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
