import { LogoMark } from "@/components/logo"
import { CommandDemo } from "./command-demo"

// La app en pequeño, flotando e inclinada en la portada: la barra marino de
// MarchaSolo, el menú lateral y, dentro, la tarea que acaba en tu aprobación.
// Es una ilustración: nada es clicable.
const NAV = [
  { label: "Hoy", icon: "M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4z" },
  { label: "Bandeja", icon: "M4 6h16v12H4zM4 13h5l1.5 2h3L15 13h5" },
  { label: "Aprobaciones", icon: "M5 12.5l4.5 4.5L19 7.5", active: true, badge: "1" },
  { label: "Automatizaciones", icon: "M7 4v6M7 14v6M17 4v2M17 10v10M4 10h6M14 6h6M4 14h6" },
]

export function AppPreview() {
  return (
    <div className="preview-stage">
      <div className="preview">
        <div className="preview-top" aria-hidden="true">
          <LogoMark size={22} />
          <span className="preview-top-name">
            Marcha<span>Solo</span>
          </span>
          <span className="preview-top-space">Inmobiliaria Centro</span>
        </div>
        <div className="preview-body">
          <ul className="preview-nav" aria-hidden="true">
            {NAV.map((n) => (
              <li key={n.label} className={n.active ? "is-active" : undefined}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={n.icon} />
                </svg>
                <span>{n.label}</span>
                {n.badge ? <b>{n.badge}</b> : null}
              </li>
            ))}
          </ul>
          <div className="preview-main">
            <CommandDemo />
          </div>
        </div>
      </div>
    </div>
  )
}

// Garantías bajo la portada: solo hechos del producto, sin cifras ni logos.
const GUARANTEES = [
  { title: "Revisión de acciones", text: "Los envíos y cambios que requieren autorización quedan pendientes de revisión.", icon: "M5 12.5l4.5 4.5L19 7.5" },
  { title: "Claves cifradas", text: "Las credenciales se almacenan cifradas y no se muestran nuevamente.", icon: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z" },
  { title: "Cada espacio, aislado", text: "Tus datos no se mezclan con los de nadie.", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { title: "Tu IA, tu factura", text: "Estimación del consumo de IA y configuración de presupuesto.", icon: "M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.4 4.5 3.2-2 3-4.5 3-4.5-1.3-4.5-3" },
]

export function GuaranteeStrip() {
  return (
    <section className="guarantees" aria-label="Garantías">
      <ul className="site-container">
        {GUARANTEES.map((g) => (
          <li key={g.title}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={g.icon} />
            </svg>
            <span>
              <b>{g.title}</b>
              {g.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
