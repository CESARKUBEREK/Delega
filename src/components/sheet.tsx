import type { ReactNode } from "react"

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
        {/* Cota: línea de dimensión con sus marcas de extremo. */}
        <div aria-hidden="true" className="mb-3 flex items-center gap-2 text-graphite">
          <span className="h-3 w-px bg-current" />
          <span className="h-px flex-1 bg-current opacity-60" />
          <span className="h-3 w-px bg-current" />
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
              <p className="rotulo text-base text-ink">Delega</p>
              <p className="text-xs text-graphite">{sheetName}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
