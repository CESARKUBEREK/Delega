"use client"

import { useState } from "react"

export function CheckoutLegalConsents({
  countryCode,
  recurring,
  priceDescription,
  renewalDescription,
  onValidityChange,
}: {
  countryCode: "ES" | "AR" | "MX"
  recurring: boolean
  priceDescription: string
  renewalDescription: string
  onValidityChange?: (value: { recurringAccepted: boolean; immediateStartAccepted: boolean; valid: boolean }) => void
}) {
  const [recurringAccepted, setRecurringAccepted] = useState(false)
  const [immediateStartAccepted, setImmediateStartAccepted] = useState(false)
  const needsImmediateStartConsent = countryCode === "ES"
  const valid = (!recurring || recurringAccepted) && (!needsImmediateStartConsent || immediateStartAccepted)

  function update(recurringValue: boolean, immediateValue: boolean) {
    onValidityChange?.({
      recurringAccepted: recurringValue,
      immediateStartAccepted: immediateValue,
      valid: (!recurring || recurringValue) && (!needsImmediateStartConsent || immediateValue),
    })
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-rule bg-sheet p-4">
      <legend className="px-1 text-sm font-semibold text-ink">Autorizaciones de contratación</legend>
      {recurring ? (
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            required
            checked={recurringAccepted}
            onChange={(event) => {
              setRecurringAccepted(event.target.checked)
              update(event.target.checked, immediateStartAccepted)
            }}
            className="mt-1 size-4 shrink-0 accent-current"
          />
          <span>
            Autorizo expresamente los cobros recurrentes de {priceDescription}, con periodicidad {renewalDescription,
            } hasta que cancele la suscripción. He podido consultar el importe, la frecuencia y las condiciones de cancelación.
          </span>
        </label>
      ) : null}
      {needsImmediateStartConsent ? (
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            required
            checked={immediateStartAccepted}
            onChange={(event) => {
              setImmediateStartAccepted(event.target.checked)
              update(recurringAccepted, event.target.checked)
            }}
            className="mt-1 size-4 shrink-0 accent-current"
          />
          <span>
            Solicito expresamente que MarchaSolo comience a prestar el servicio digital durante el plazo de desistimiento.
            Reconozco que, cuando el servicio se haya ejecutado íntegramente y se cumplan los requisitos legales, podré perder
            el derecho de desistimiento. Esta autorización es independiente de la aceptación de los términos.
          </span>
        </label>
      ) : null}
      <p className="text-xs text-graphite">
        Estas autorizaciones deben registrarse por separado, con fecha, versión del texto y evidencia de la decisión. No se utilizan casillas premarcadas.
      </p>
      <input type="hidden" name="consent_recurring_payment" value={recurringAccepted ? "accepted" : "not_accepted"} />
      <input type="hidden" name="consent_immediate_service_start" value={immediateStartAccepted ? "accepted" : "not_accepted"} />
      <input type="hidden" name="consents_valid" value={valid ? "true" : "false"} />
    </fieldset>
  )
}
