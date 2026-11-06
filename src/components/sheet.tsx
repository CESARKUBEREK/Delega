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
                <h2>Qué pasa al crear tu cuenta</h2>
                <ol className="access-next">
                  <li>
                    <b>Nos cuentas qué te gustaría mejorar</b>
                    Puedes describir una tarea o pedirnos ayuda para descubrir oportunidades en tu negocio.
                  </li>
                  <li>
                    <b>Conocemos mejor tu negocio</b>
                    Si tienes web, la analizamos; si no, nos cuentas lo que quieras. Tú revisas el perfil antes de confirmarlo.
                  </li>
                  <li>
                    <b>Ves tu propuesta de trabajo</b>
                    MarchaSolo prepara un plan con IA, antes de conectar tus aplicaciones.
                  </li>
                  <li>
                    <b>Conectas lo que haga falta</b>
                    Primero tu IA; después el correo, Drive o la agenda. Nada se envía sin tu aprobación.
                  </li>
                </ol>
              </>
            ) : (
              <>
                <h2>Las tareas avanzan. Tú decides.</h2>
                <ol className="access-next">
                  <li>
                    <b>Lo pides con tus palabras</b>
                    MarchaSolo lo convierte en pasos.
                  </li>
                  <li>
                    <b>MarchaSolo hace el trabajo</b>
                    Lee, consulta y redacta con tus aplicaciones.
                  </li>
                  <li>
                    <b>Tú apruebas</b>
                    Nada se envía ni se cambia sin tu visto bueno.
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
