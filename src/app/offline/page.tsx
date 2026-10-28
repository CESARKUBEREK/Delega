import { Logo } from "@/components/logo"

// Página que muestra el service worker cuando no hay conexión. Es estática y
// no contiene datos: nada de lo que se ve en la app queda guardado en el móvil.
export const metadata = { title: "Sin conexión" }

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo size={40} id="orkesta-offline" />
      <div>
        <h1 className="rotulo text-2xl text-ink">Sin conexión</h1>
        <p className="mt-2 text-graphite">
          MarchaSolo necesita internet para leer tus datos y preparar las tareas. Revisa la conexión y vuelve a intentarlo.
        </p>
      </div>
      <a href="/abrir" className="inline-flex h-11 items-center bg-stroke px-5 font-semibold text-stroke-ink hover:opacity-90">
        Reintentar
      </a>
    </main>
  )
}
