import { Suspense } from "react"
import { PageHeader, PanelCard, StatusBadge, InfoBanner } from "@/components/ui"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { BillingProfileForm } from "./billing-profile-form"

export const metadata = { title: "Facturación" }

export default function BillingPage({ params }: PageProps<"/w/[workspaceId]/facturacion">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-2xl border border-rule bg-sheet" aria-busy="true" />}>
      <BillingContent params={params} />
    </Suspense>
  )
}

async function BillingContent({ params }: { params: PageProps<"/w/[workspaceId]/facturacion">["params"] }) {
  const { workspaceId } = await params
  const { isAdmin } = await getWorkspace(workspaceId, "/w/" + workspaceId + "/facturacion")
  const supabase = await createClient()

  const [{ data: plans }, { data: prices }, { data: profile }] = await Promise.all([
    supabase.from("billing_plans").select("id, code, name, description, capabilities").eq("active", true).order("code"),
    supabase.from("plan_prices").select("id, plan_id, market_code, currency, amount_minor, interval_unit, interval_count").eq("active", true).eq("market_code", "GLOBAL").eq("currency", "USD").order("amount_minor"),
    isAdmin
      ? supabase.from("billing_customers").select("customer_type, legal_name, billing_email, country_code, region, city, postal_code, address_line1, address_line2").eq("workspace_id", workspaceId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
  const formatPrice = (minor: number) => currency.format(minor / 100)
  const plansWithPrices = (plans ?? []).map((plan) => ({
    ...plan,
    prices: (prices ?? []).filter((price) => price.plan_id === plan.id),
  }))

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="GESTIÓN DEL ESPACIO" title="Facturación y planes" description="Consulta los planes de MarchaSolo y mantén actualizados los datos de facturación de tu espacio." />
      <InfoBanner tone="info">
        La contratación y los cobros en línea todavía no están habilitados. Esta sección prepara el perfil de facturación y muestra las tarifas configuradas; no realiza cargos ni crea suscripciones.
      </InfoBanner>
      <section className="flex flex-col gap-4" aria-labelledby="plans-title">
        <div>
          <p className="app-eyebrow">PLANES DISPONIBLES</p>
          <h2 id="plans-title" className="rotulo text-xl">Elige cómo quieres trabajar</h2>
          <p className="mt-1 text-sm text-graphite">Precios de referencia en USD. Los impuestos aplicables se determinarán según el país y la condición del cliente.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plansWithPrices.map((plan) => {
            const monthly = plan.prices.find((price) => price.interval_unit === "month")
            const yearly = plan.prices.find((price) => price.interval_unit === "year")
            return (
              <article key={plan.id} className="flex flex-col gap-4 rounded-2xl border border-rule bg-sheet p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="rotulo text-lg">{plan.name}</h3>
                    {plan.code === "pro" ? <StatusBadge tone="info">Más capacidad</StatusBadge> : null}
                  </div>
                  <p className="mt-1 min-h-10 text-sm text-graphite">{plan.description}</p>
                </div>
                <div className="border-y border-rule py-3">
                  {monthly ? <p className="text-2xl font-semibold text-ink">{formatPrice(monthly.amount_minor)}<span className="text-sm font-normal text-graphite"> / mes</span></p> : <p className="text-sm text-graphite">Precio mensual no disponible</p>}
                  {yearly ? <p className="mt-1 text-sm text-graphite">{formatPrice(yearly.amount_minor)} / año</p> : null}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs text-graphite">
                  {Object.entries(plan.capabilities as Record<string, unknown>).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-canvas px-3 py-2">
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd className="mt-0.5 font-semibold text-ink">{typeof value === "boolean" ? (value ? "Incluido" : "No incluido") : String(value)}</dd>
                    </div>
                  ))}
                </dl>
                <span className="mt-auto text-xs text-graphite">Contratación próximamente</span>
              </article>
            )
          })}
        </div>
      </section>
      <PanelCard title="Datos de facturación" description={isAdmin ? "Estos datos se utilizarán para preparar la facturación del espacio." : "Solo los propietarios y administradores pueden consultar o modificar estos datos."}>
        {isAdmin ? <BillingProfileForm workspaceId={workspaceId} initialProfile={profile} /> : <p className="text-sm text-graphite">Solicita a un propietario o administrador que actualice los datos de facturación.</p>}
      </PanelCard>
      <p className="text-xs text-graphite">MarchaSolo es operado y facturado por CYRANO SAS. Las tarifas e impuestos finales se mostrarán antes de confirmar cualquier contratación.</p>
    </div>
  )
}
