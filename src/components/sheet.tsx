import Link from "next/link"
import type { ReactNode } from "react"
import { Logo } from "./logo"
import { SiteFooter } from "./site/site-footer"

// Marco de las páginas de acceso (entrar, crear cuenta, contraseña): a un lado
// el formulario; al otro, qué es MarchaSolo o qué pasa al crear la cuenta.
export function Sheet({
  title,
  intro,
  children,
  footer,
  story = "access",
}: {
  title: string
  // Nombre antiguo de la lámina; ya no se muestra.
  sheetName?: string
  intro?: ReactNode
  children: ReactNode
  footer?: ReactNode
  story?: "access" | "signup"
}) {
  return (
    <>
      <main className="access">
        <section className="access-story" aria-label={story === "signup" ? "Qué pasa al crear tu cuenta" : "MarchaSolo"}>
          <Link href="/" aria-label="MarchaSolo, inicio" className="site-brand self-start">
            <Logo size={34} />
          </Link>
          <div className="access-story-main">
            {story === "signup" ? (
              <>
                <h2>Qué ocurre al crear una cuenta</h2>
                <ol className="access-next">
                  <li>
                    <b>Confirmación del correo</b>
                    Se envía un enlace de confirmación. Con Google, este paso no es necesario.
                  </li>
                  <li>
                    <b>Definición de objetivos</b>
                    Es posible describir una tarea o identificar oportunidades de mejora para el negocio.
                  </li>
                  <li>
                    <b>Propuesta inicial</b>
                    Si existe una web del negocio, se puede analizar y revisar el perfil antes de confirmarlo. Después se muestran las opciones de plan, sin conectar aplicaciones.
                  </li>
                  <li>
                    <b>Conexión de aplicaciones</b>
                    Se conectan los servicios necesarios para la tarea. Las acciones que requieren autorización quedan pendientes de revisión.
                  </li>
                </ol>
              </>
            ) : (
              <>
                <h2>Las tareas avanzan con supervisión.</h2>
                <ol className="access-next">
                  <li>
                    <b>Descripción de la tarea</b>
                    MarchaSolo la convierte en pasos.
                  </li>
                  <li>
                    <b>MarchaSolo hace el trabajo</b>
                    Lee, consulta y redacta con tus aplicaciones.
                  </li>
                  <li>
                    <b>Revisión y autorización</b>
                    Las acciones que requieren aprobación quedan pendientes hasta su revisión.
                  </li>
                </ol>
              </>
            )}
          </div>
          <p className="access-story-foot">Tu negocio, en automático.</p>
        </section>

        <section className="access-form">
          <div className="access-top">
            <Link href="/" aria-label="MarchaSolo, inicio" className="site-brand access-mobile-brand">
              <Logo size={30} />
            </Link>
            <Link href="/" className="link">
              Volver al inicio
            </Link>
          </div>
          <div className="access-card">
            <h1>{title}</h1>
            {intro ? <p className="access-intro">{intro}</p> : null}
            <div className="auth-form-content">{children}</div>
            {footer ? <div className="access-card-footer">{footer}</div> : null}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
