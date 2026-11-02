// Mini panel con el aspecto de MarchaSolo, para ilustrar una tarea en las
// páginas públicas. Cada fila lleva su estado: hecho, espera tu aprobación o
// aviso para ti.
export type PanelRow = { title: string; detail?: string; state: "done" | "wait" | "info"; label: string }

export function Panel({ title, meta, rows }: { title: string; meta?: string; rows: PanelRow[] }) {
  return (
    <figure className="panel m-0" aria-label={`Ejemplo: ${title}`}>
      <div className="panel-head">
        {title}
        {meta ? <span>{meta}</span> : null}
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.title}>
            <span>
              <b>{r.title}</b>
              {r.detail ? <small>{r.detail}</small> : null}
            </span>
            <span className={`state is-${r.state}`}>{r.label}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
