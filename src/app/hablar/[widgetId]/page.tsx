import { Suspense } from "react"
import { VoiceCall } from "./voice-call"

// Asistente de voz en la web del cliente: esta página se abre dentro del botón
// que el negocio inserta en su web (public/widget-voz.js), o sola para probarla.
export const metadata = { title: "Habla con nosotros" }

export default function TalkPage({ params }: PageProps<"/hablar/[widgetId]">) {
  return (
    <main className="voice-web flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-8 text-center">
      <Suspense fallback={<p className="text-graphite">Cargando…</p>}>
        <Call params={params} />
      </Suspense>
    </main>
  )
}

async function Call({ params }: { params: PageProps<"/hablar/[widgetId]">["params"] }) {
  const { widgetId } = await params
  return <VoiceCall widgetId={/^msw_[A-Za-z0-9_-]{20,60}$/.test(widgetId) ? widgetId : ""} />
}
