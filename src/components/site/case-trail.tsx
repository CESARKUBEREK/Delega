import type { UseCase } from "@/lib/site-content"

// Rastro de un caso: la tarea solicitada, el trabajo de MarchaSolo y las acciones pendientes de revisión. Mismo lenguaje visual que la consola del inicio.
export function CaseTrail({ item, short = false }: { item: UseCase; short?: boolean }) {
  return (
    <dl className="trail">
      <div className="is-ask">
        <dt>La tarea</dt>
        <dd>{item.ask}</dd>
      </div>
      <div>
        <dt>MarchaSolo</dt>
        <dd>{item.does}</dd>
      </div>
      {!short ? (
        <div className={item.waits ? "is-wait" : undefined}>
          <dt>{item.waits ? "Pendiente de revisión" : "Aviso interno"}</dt>
          <dd>{item.waits ?? "Envía un aviso interno."}</dd>
        </div>
      ) : null}
    </dl>
  )
}
