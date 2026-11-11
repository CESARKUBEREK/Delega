"use client"

import { useState } from "react"

type Profile = {
  customer_type: "consumer" | "professional" | "business"
  legal_name: string
  billing_email: string
  country_code: string
  region: string
  city: string
  postal_code: string
  address_line1: string
  address_line2: string
}

const COUNTRIES = [
  ["ES", "España"], ["AR", "Argentina"], ["MX", "México"], ["DE", "Alemania"],
  ["IT", "Italia"], ["PT", "Portugal"], ["NL", "Países Bajos"], ["BE", "Bélgica"],
  ["IE", "Irlanda"], ["AT", "Austria"], ["PL", "Polonia"], ["SE", "Suecia"],
  ["DK", "Dinamarca"], ["FI", "Finlandia"], ["GR", "Grecia"], ["CZ", "Chequia"],
  ["RO", "Rumanía"], ["HU", "Hungría"], ["HR", "Croacia"], ["SK", "Eslovaquia"],
  ["SI", "Eslovenia"], ["BG", "Bulgaria"], ["CY", "Chipre"], ["EE", "Estonia"],
  ["LV", "Letonia"], ["LT", "Lituania"], ["LU", "Luxemburgo"], ["MT", "Malta"],
  
] as const

export function BillingProfileForm({ workspaceId, initialProfile }: {
  workspaceId: string
  initialProfile: Partial<Record<keyof Profile, string | null>> | null
}) {
  const [profile, setProfile] = useState<Profile>({
    customer_type: initialProfile?.customer_type === "professional" || initialProfile?.customer_type === "business" ? initialProfile.customer_type : "consumer",
    legal_name: initialProfile?.legal_name ?? "",
    billing_email: initialProfile?.billing_email ?? "",
    country_code: initialProfile?.country_code ?? "ES",
    region: initialProfile?.region ?? "",
    city: initialProfile?.city ?? "",
    postal_code: initialProfile?.postal_code ?? "",
    address_line1: initialProfile?.address_line1 ?? "",
    address_line2: initialProfile?.address_line2 ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null)

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch("/api/workspaces/" + workspaceId + "/billing-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(result?.error ?? "No se pudieron guardar los datos.")
      }
      setMessage({ kind: "success", text: "Los datos de facturación se guardaron." })
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "No se pudieron guardar los datos." })
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = "mt-1 w-full rounded-xl border border-rule bg-sheet px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
  const labelClass = "block text-sm font-medium text-ink"

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Tipo de cliente
          <select className={fieldClass} value={profile.customer_type} onChange={(event) => update("customer_type", event.target.value as Profile["customer_type"])}>
            <option value="consumer">Particular</option>
            <option value="professional">Profesional / autónomo</option>
            <option value="business">Empresa</option>
          </select>
        </label>
        <label className={labelClass}>
          País de facturación
          <select className={fieldClass} value={profile.country_code} onChange={(event) => update("country_code", event.target.value)}>
            {COUNTRIES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label className={labelClass + " sm:col-span-2"}>
          Nombre o razón social
          <input className={fieldClass} value={profile.legal_name} maxLength={200} onChange={(event) => update("legal_name", event.target.value)} autoComplete="organization" />
        </label>
        <label className={labelClass + " sm:col-span-2"}>
          Correo para facturación
          <input className={fieldClass} type="email" value={profile.billing_email} maxLength={254} onChange={(event) => update("billing_email", event.target.value)} autoComplete="email" />
        </label>
        <label className={labelClass}>
          Provincia / Estado
          <input className={fieldClass} value={profile.region} maxLength={100} onChange={(event) => update("region", event.target.value)} autoComplete="address-level1" />
        </label>
        <label className={labelClass}>
          Ciudad
          <input className={fieldClass} value={profile.city} maxLength={100} onChange={(event) => update("city", event.target.value)} autoComplete="address-level2" />
        </label>
        <label className={labelClass}>
          Código postal
          <input className={fieldClass} value={profile.postal_code} maxLength={30} onChange={(event) => update("postal_code", event.target.value)} autoComplete="postal-code" />
        </label>
        <label className={labelClass}>
          Dirección
          <input className={fieldClass} value={profile.address_line1} maxLength={200} onChange={(event) => update("address_line1", event.target.value)} autoComplete="address-line1" />
        </label>
        <label className={labelClass + " sm:col-span-2"}>
          Complemento de dirección
          <input className={fieldClass} value={profile.address_line2} maxLength={200} onChange={(event) => update("address_line2", event.target.value)} autoComplete="address-line2" />
        </label>
      </div>
      {message ? <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-red-700" : "text-sm text-emerald-700"}>{message.text}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
        <p className="max-w-xl text-xs text-graphite">El identificador fiscal y los impuestos se solicitarán cuando correspondan al país y al tipo de cliente.</p>
        <button type="submit" disabled={saving} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar datos"}
        </button>
      </div>
    </form>
  )
}
