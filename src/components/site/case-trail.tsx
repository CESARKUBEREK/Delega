import type { UseCase } from "@/lib/site-content"

// Rastro de un caso: lo que pides, lo que hace MarchaSolo, lo que espera tu
// aprobación y el resultado. Mismo lenguaje visual que la consola del inicio.
export function CaseTrail({ item, short = false }: { item: UseCase; short?: boolean }) {
  return (
    <dl className="trail">
      <div className="is-ask">
        <dt>Le pides</dt>
        <dd>{item.ask}</dd>
      </div>
      <div>
        <dt>MarchaSolo</dt>
        <dd>{item.does}</dd>
      </div>
      {!short ? (
        <div className={item.waits ? "is-wait" : undefined}>
          <dt>{item.waits ? "Espera tu aprobación" : "Sin aprobación"}</dt>
          <dd>{item.waits ?? "Solo te avisa a ti."}</dd>
        </div>
      ) : null}
    </dl>
  )
}
