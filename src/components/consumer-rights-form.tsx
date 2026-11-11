"use client"

import { useState } from "react"

type RequestType = "withdrawal" | "cancellation"

export function ConsumerRightsForm({ requestType }: { requestType: RequestType }) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [orderReference, setOrderReference] = useState("")
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const withdrawal = requestType === "withdrawal"
  const fieldClass = "mt-1 w-full rounded-xl border border-[var(--ms-line)] bg-white px-3 py-3 text-sm text-[var(--ms-ink)] outline-none focus:border-[var(--ms-ink)]"

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/consumer-rights/argentina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType, fullName, email, orderReference, message,
          website,
        }),
      })
      const result = await response.json() as { reference?: string; error?: string }
      if (!response.ok || !result.reference) {
        throw new Error(result.error === "rate_limit_exceeded"
          ? "Se alcanzó el límite temporal de solicitudes. Inténtalo más tarde."
          : "No pudimos registrar la solicitud. Revisa los datos e inténtalo nuevamente.")
      }
      setReference(result.reference)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos registrar la solicitud.")
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <div className="rounded-2xl border border-[var(--ms-line)] bg-[var(--ms-white)] p-6" role="status">
        <h2 className="text-xl font-semibold">Solicitud registrada</h2>
        <p className="mt-2 text-sm">Tu código de solicitud es:</p>
        <p className="mt-2 text-2xl font-semibold tracking-wide">{reference}</p>
        <p className="mt-3 text-sm">Guarda este código para futuras consultas. MarchaSolo registró tu solicitud en la fecha y hora indicadas por el sistema.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-[var(--ms-line)] bg-[var(--ms-white)] p-6">
      <p className="text-sm text-[var(--ms-graphite)]">
        {withdrawal
          ? "Utiliza este formulario para ejercer el derecho de arrepentimiento cuando corresponda. No necesitas iniciar sesión ni crear una cuenta."
          : "Utiliza este formulario para solicitar la baja del servicio. No necesitas iniciar sesión ni crear una cuenta."}
      </p>
      <label className="block text-sm font-medium">Nombre y apellido
        <input required minLength={2} maxLength={160} autoComplete="name" className={fieldClass} value={fullName} onChange={e => setFullName(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Correo asociado a la contratación
        <input required type="email" maxLength={254} autoComplete="email" className={fieldClass} value={email} onChange={e => setEmail(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Número de pedido o referencia (opcional)
        <input maxLength={120} className={fieldClass} value={orderReference} onChange={e => setOrderReference(e.target.value)} />
      </label>
      <label className="block text-sm font-medium">Información adicional (opcional)
        <textarea maxLength={2000} rows={4} className={fieldClass} value={message} onChange={e => setMessage(e.target.value)} />
      </label>
      <label className="hidden" aria-hidden="true">No completar
        <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
      </label>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={submitting} className="w-fit rounded-full bg-[var(--ms-ink)] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {submitting ? "Enviando…" : withdrawal ? "Enviar arrepentimiento" : "Solicitar baja"}
      </button>
      <p className="text-xs text-[var(--ms-graphite)]">El registro de esta solicitud no exige registro, inicio de sesión ni trámites adicionales. Para consultas: legal@marchasolo.com.</p>
    </form>
  )
}
