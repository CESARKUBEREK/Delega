import { MarketingLayout } from "@/components/marketing-layout"
import { ConsumerRightsForm } from "@/components/consumer-rights-form"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Botón de arrepentimiento",
  description: "Ejerce tu derecho de arrepentimiento en Argentina, cuando corresponda, sin iniciar sesión ni crear una cuenta.",
  path: "/boton-de-arrepentimiento",
})

export default function ConsumerRightsPage() {
  return (
    <MarketingLayout>
      <main className="legal-page">
        <p className="app-eyebrow">DERECHOS DE CONSUMIDORES · ARGENTINA</p>
        <h1 className="rotulo">Botón de arrepentimiento</h1>
        <p>Ejerce tu derecho de arrepentimiento en Argentina, cuando corresponda, sin iniciar sesión ni crear una cuenta.</p>
        <ConsumerRightsForm requestType="withdrawal" />
        <p className="mt-5 text-xs text-[var(--ms-graphite)]">
          La recepción de la solicitud no prejuzga sobre su procedencia ni limita los derechos reconocidos por la normativa aplicable.
          Si necesitas asistencia, escribe a <a href="mailto:legal@marchasolo.com">legal@marchasolo.com</a>.
        </p>
      </main>
    </MarketingLayout>
  )
}
