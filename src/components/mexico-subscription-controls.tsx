"use client"

import { useState } from "react"

type Subscription = {
  id: string
  status: string
  current_period_end: string | null
  provider: string | null
}

export function MexicoSubscriptionControls({
  countryCode,
  subscriptions,
}: {
  countryCode: string | null
  subscriptions: Subscription[]
}) {
  const [items, setItems] = useState(subscriptions)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  if (countryCode !== "MX" || items.length === 0) return null

  async function cancel(id: string) {
    setBusy(id)
    setMessage(null)
    try {
      const response = await fetch("/api/billing/subscriptions/" + id + "/cancel", { method: "POST" })
      const result = await response.json() as { canceled?: boolean; error?: string; message?: string }
      if (!response.ok || !result.canceled) {
        throw new Error(result.message ?? "No se pudo completar la cancelación. Contacta con legal@marchasolo.com.")
      }
      setItems(current => current.filter(item => item.id !== id))
      setMessage("La suscripción quedó cancelada inmediatamente.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la cancelación.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-sheet p-5" aria-labelledby="mx-subscriptions">
      <div>
        <p className="app-eyebrow">MÉXICO · SUSCRIPCIONES</p>
        <h2 id="mx-subscriptions" className="rotulo text-xl">Gestionar suscripción</h2>
        <p className="mt-1 text-sm text-graphite">Puedes solicitar la cancelación inmediata, sin penalización.</p>
      </div>
      {items.map(item => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
          <div className="text-sm">
            <p className="font-semibold text-ink">Suscripción {item.id.slice(0, 8)}</p>
            <p className="text-graphite">{item.current_period_end ? "Renovación prevista: " + new Date(item.current_period_end).toLocaleDateString("es-MX") : "Fecha de renovación no disponible"}</p>
          </div>
          <button type="button" onClick={() => cancel(item.id)} disabled={busy !== null} className="rounded-full border border-ink px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60">
            {busy === item.id ? "Cancelando…" : "Cancelar ahora"}
          </button>
        </div>
      ))}
      {message ? <p role="status" className="text-sm text-graphite">{message}</p> : null}
    </section>
  )
}
