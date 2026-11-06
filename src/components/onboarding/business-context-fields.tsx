"use client"

import type { BusinessProfile } from "@/lib/business-discovery/business-profile"
import { BUSINESS_PROFILE_FIELDS } from "@/lib/business-discovery/business-profile"
import type { WebsiteSnapshot } from "@/lib/business-discovery/website-parser"

const CONTACT_CHANNELS = [
  ["email", "Correo"],
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram / redes"],
  ["website", "Web / formularios"],
  ["phone", "Teléfono"],
  ["in_person", "En persona"],
] as const

type ProfileField = keyof BusinessProfile

type BusinessContextProps = {
  websiteUrl: string
  onWebsiteUrlChange: (value: string) => void
  onAnalyzeWebsite: () => void
  onEnrichWebsite: () => void
  semanticPending: boolean
  semanticError: string | null
  semanticMessage: string | null
  websitePending: boolean
  disabled: boolean
  websiteError: string | null
  websiteSnapshot: WebsiteSnapshot | null
  businessProfile: BusinessProfile | null
  onProfileFieldChange: (key: ProfileField, value: string) => void
  profileConfirmed: boolean
  onConfirmProfile: () => void
  onRemoveAnalysis: () => void
  businessType: string
  onBusinessTypeChange: (value: string) => void
  mainPain: string
  onMainPainChange: (value: string) => void
  channels: string[]
  onChannelChange: (value: string, checked: boolean) => void
}

export function BusinessContextFields({
  websiteUrl,
  onWebsiteUrlChange,
  onAnalyzeWebsite,
  onEnrichWebsite,
  semanticPending,
  semanticError,
  semanticMessage,
  websitePending,
  disabled,
  websiteError,
  websiteSnapshot,
  businessProfile,
  onProfileFieldChange,
  profileConfirmed,
  onConfirmProfile,
  onRemoveAnalysis,
  businessType,
  onBusinessTypeChange,
  mainPain,
  onMainPainChange,
  channels,
  onChannelChange,
}: BusinessContextProps) {
  const filledFields = businessProfile
    ? BUSINESS_PROFILE_FIELDS.filter(({ key }) => businessProfile[key].value.trim()).length
    : 0

  return (
    <>
      <div className="rounded-xl border border-rule bg-paper p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-graphite">1 · Conocer tu negocio</p>
          <label htmlFor="website-url" className="mt-1 block text-sm font-semibold text-ink">¿Tienes una web? <span className="font-normal text-graphite">(opcional)</span></label>
          <p className="mt-1 text-sm text-graphite">Analizamos las páginas públicas para preparar un perfil inicial. No necesitamos acceso ni contraseña. Si no tienes web, puedes contarnos tu actividad más abajo.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="website-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            value={websiteUrl}
            onChange={(event) => onWebsiteUrlChange(event.target.value)}
            placeholder="marchasolo.com o www.marchasolo.com"
            maxLength={2048}
            disabled={semanticPending || websitePending || disabled}
            className="min-w-0 flex-1 rounded-xl border border-rule bg-paper px-3 py-2 text-ink placeholder:text-graphite focus:border-stroke focus:outline-none"
          />
          <button type="button" onClick={onAnalyzeWebsite} disabled={!websiteUrl.trim() || disabled || websitePending || semanticPending} className="inline-flex h-10 items-center justify-center rounded-xl border border-ink px-4 text-sm font-semibold text-ink disabled:opacity-50">
            {websitePending ? "Analizando…" : "Analizar mi web"}
          </button>
        </div>
        {websiteError ? <p className="text-sm text-alert" role="alert">{websiteError}</p> : null}
        {websiteSnapshot && businessProfile ? (
          <div className="rounded-lg border border-rule bg-sheet p-4 flex flex-col gap-3" aria-live="polite">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Esto es lo que hemos entendido</p>
              <p className="mt-1 font-semibold text-ink">{websiteSnapshot.title ?? websiteSnapshot.url}</p>
              <p className="mt-1 text-xs text-graphite">{websiteSnapshot.pages.length > 1 ? `Hemos revisado ${websiteSnapshot.pages.length} páginas públicas del mismo dominio.` : "Hemos revisado una página pública."} Usamos títulos, metadatos, contenido de página y datos estructurados disponibles. Corrige lo que haga falta; los campos vacíos no se han podido verificar.</p>
              {websiteSnapshot.language ? <p className="mt-1 text-xs text-graphite">Idioma detectado: {websiteSnapshot.language}</p> : null}
              {websiteSnapshot.pages.some((page) => page.contentSource === "rendered_html") ? <p className="mt-1 text-xs text-graphite">El contenido dinámico de algunas páginas se ha recuperado mediante un navegador aislado.</p> : websiteSnapshot.pages.some((page) => page.contentSource === "embedded_data") ? <p className="mt-1 text-xs text-graphite">Parte del contenido se ha recuperado de datos estructurados o de la carga inicial de la web; no todas las páginas permiten leer el contenido dinámico.</p> : null}
              {websiteSnapshot.pages.some((page) => page.contentQuality === "javascript_shell") ? (
                <p className="mt-2 rounded-lg border border-alert/30 bg-alert/5 p-3 text-sm text-alert" role="status">
                  Algunas páginas cargan su contenido mediante JavaScript y no han podido leerse completamente. El análisis puede estar incompleto; revisa los campos y complétalos manualmente antes de confirmar.
                </p>
              ) : websiteSnapshot.pages.some((page) => page.contentQuality === "metadata_only") ? (
                <p className="mt-2 rounded-lg border border-rule bg-paper p-3 text-sm text-graphite" role="status">
                  Una o más páginas solo han proporcionado metadatos. La información disponible puede ser limitada; comprueba los campos antes de confirmar.
                </p>
              ) : null}
              <p className="mt-1 break-all text-xs text-graphite">Páginas consultadas: {websiteSnapshot.pages.map((page) => page.url).join(" · ")}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-rule bg-paper p-3">
              <div>
                <p className="text-sm font-semibold text-ink">Mejorar la lectura con IA <span className="font-normal text-graphite">(opcional)</span></p>
                <p className="mt-1 text-xs text-graphite">La IA interpreta el contenido y puede completar datos que el análisis inicial no haya identificado. Solo se utiliza cuando pulsas el botón; antes verás si consume un crédito de tu espacio o de prueba. Al pulsar, autorizas el uso de la IA conectada.</p>
              </div>
              <button type="button" onClick={onEnrichWebsite} disabled={semanticPending || websitePending || disabled} className="inline-flex h-10 items-center justify-center self-start rounded-xl border border-ink px-4 text-sm font-semibold text-ink disabled:opacity-50">
                {semanticPending ? "Completando el análisis…" : "Completar análisis con IA"}
              </button>
              {semanticError ? <p className="text-sm text-alert" role="alert">{semanticError}</p> : null}
              {semanticMessage ? <p className="text-sm text-graphite" role="status">{semanticMessage}</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Perfil detectado</p>
              <span className="text-xs text-graphite">{filledFields} de {BUSINESS_PROFILE_FIELDS.length} campos con información</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {BUSINESS_PROFILE_FIELDS.map(({ key, label, hint }) => (
                <label key={key} className="flex flex-col gap-1 text-sm font-medium text-ink">
                  {label}
                  <span className="text-xs font-normal text-graphite">{hint}</span>
                  <textarea
                    rows={2}
                    disabled={semanticPending}
                    value={businessProfile[key].value}
                    onChange={(event) => onProfileFieldChange(key, event.target.value)}
                    className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink focus:border-stroke focus:outline-none"
                  />
                  {businessProfile[key].source === "user" ? (
                    <span className="text-xs font-normal text-graphite">Añadido o corregido por ti · pendiente de confirmar</span>
                  ) : businessProfile[key].evidence.length ? (
                    <span className="text-xs font-normal text-graphite">
                      {businessProfile[key].confidence === "high" ? "Varias evidencias" : "Evidencia encontrada"}: {businessProfile[key].evidence[0]}
                      <span className="block break-all">Fuente: {businessProfile[key].evidenceSources[0]}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-graphite">No encontrado en la web. Puedes completarlo o dejarlo vacío.</span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={onConfirmProfile} disabled={semanticPending} className="inline-flex h-10 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-paper">
                {profileConfirmed ? "Perfil confirmado" : "Confirmar perfil"}
              </button>
              {profileConfirmed ? <span className="text-xs text-graphite" role="status">Usaremos estos datos para adaptar tu propuesta.</span> : <span className="text-xs text-graphite">El perfil no se utilizará hasta que lo confirmes.</span>}
              <button type="button" onClick={onRemoveAnalysis} disabled={semanticPending} className="text-xs font-semibold text-link underline underline-offset-4">Quitar análisis</button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-rule bg-paper p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-graphite">2 · Completar el contexto</p>
          <p className="mt-1 text-sm font-semibold text-ink">Cuéntame cómo funciona tu negocio <span className="font-normal text-graphite">(opcional)</span></p>
          <p className="mt-1 text-xs text-graphite">Estos datos ayudan a no recomendarte automatizaciones genéricas. Puedes completar solo lo que sepas.</p>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          ¿Cuál describe mejor tu actividad?
          <select value={businessType} onChange={(event) => onBusinessTypeChange(event.target.value)} className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink">
            <option value="">Selecciona tu actividad</option>
            <option value="professional">Servicios profesionales / consultoría</option>
            <option value="agency">Agencia / estudio</option>
            <option value="retail">Comercio / tienda</option>
            <option value="real_estate">Inmobiliaria</option>
            <option value="health">Salud / clínica</option>
            <option value="hospitality">Hostelería / turismo</option>
            <option value="industry">Industria / fabricación</option>
            <option value="other">Otro tipo de negocio</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          ¿Qué tarea te quita más tiempo hoy?
          <select value={mainPain} onChange={(event) => onMainPainChange(event.target.value)} className="w-full rounded-lg border border-rule bg-paper px-3 py-2 text-sm text-ink">
            <option value="">Elige tu prioridad</option>
            <option value="customer_messages">Responder consultas y mensajes</option>
            <option value="appointments">Organizar citas y reservas</option>
            <option value="sales_followup">Hacer seguimiento de clientes y ventas</option>
            <option value="admin">Reducir tareas administrativas</option>
            <option value="billing">Facturas y cobros</option>
            <option value="reporting">Informes y control del negocio</option>
            <option value="marketing">Contenido y redes sociales</option>
            <option value="other">Otra tarea</option>
          </select>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">¿Por dónde llegan o te contactan tus clientes? <span className="font-normal text-graphite">(puedes elegir varios)</span></legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CONTACT_CHANNELS.map(([value, label]) => (
              <label key={value} className="inline-flex items-center gap-2 text-sm text-graphite">
                <input
                  type="checkbox"
                  checked={channels.includes(value)}
                  onChange={(event) => onChannelChange(value, event.target.checked)}
                  className="h-4 w-4 accent-ink"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </>
  )
}
