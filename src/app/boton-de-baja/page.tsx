import { MarketingLayout } from "@/components/marketing-layout"
import { ConsumerRightsForm } from "@/components/consumer-rights-form"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Botón de baja del servicio",
  description: "Solicita la baja del servicio MarchaSolo en Argentina, sin iniciar sesión ni crear una cuenta.",
  path: "/boton-de-baja",
})

export default function ConsumerRightsPage() {
  return (
    <MarketingLayout>
      <main className="legal-page">
        <p className="app-eyebrow">DERECHOS DE CONSUMIDORES · ARGENTINA</p>
        <h1 className="rotulo">Botón de baja del servicio</h1>
        <p>Solicita la baja del servicio MarchaSolo en Argentina, sin iniciar sesión ni crear una cuenta.</p>
        <ConsumerRightsForm requestType="cancellation" />
        <p className="mt-5 text-xs text-[var(--ms-graphite)]">
          La recepción de la solicitud no prejuzga sobre su procedencia ni limita los derechos reconocidos por la normativa aplicable.
          Si necesitas asistencia, escribe a <a href="mailto:legal@marchasolo.com">legal@marchasolo.com</a>.
        </p>
      </main>
    </MarketingLayout>
  )
}
