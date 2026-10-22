import type { ReactNode } from "react"
import { Logo } from "./logo"

// La lámina: el formulario se presenta como una hoja de plano, con una cota
// encima y el cajetín (recuadro de datos del plano) al pie.
export function Sheet({
  title,
  sheetName,
  children,
  footer,
}: {
  title: string
  sheetName: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-[26rem]">
        <div className="mb-5 flex justify-center">
          <Logo size={40} tagline id="orkesta-sheet" />
        </div>

        <section className="border border-ink bg-sheet">
          <div className="px-6 pt-7 pb-6 sm:px-8">
            <h1 className="rotulo text-[1.75rem] text-ink">{title}</h1>
            <div className="mt-6">{children}</div>
          </div>

          {/* Cajetín */}
          <div className="grid grid-cols-[1fr_auto] border-t border-ink text-sm">
            <div className="px-6 py-3 text-graphite sm:px-8">{footer}</div>
            <div className="border-l border-ink px-4 py-3">
              <p className="logotipo text-sm text-ink">ORKESTA</p>
              <p className="text-xs text-graphite">{sheetName}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
