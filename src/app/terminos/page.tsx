import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { LEGAL } from "@/lib/legal"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Términos de uso",
  description: `Estos términos regulan el uso de MarchaSolo, que ofrece ${LEGAL.owner} (${LEGAL.country}).`,
  path: "/terminos",
})

export default function TermsPage() {
  return (
    <MarketingLayout>
      <main className="legal-page">
        <p className="app-eyebrow">CONDICIONES DEL SERVICIO</p>
        <h1 className="rotulo">Términos de uso</h1>
        <p className="legal-updated">Última actualización: {LEGAL.updated}</p>

        <div className="mt-6 rounded-2xl border border-[var(--ms-line)] bg-[var(--ms-white)] p-5">
          <h2 className="m-0 text-lg font-semibold">Antes de empezar</h2>
          <p className="mb-0 mt-2">
            Estos términos explican quién ofrece MarchaSolo, cómo funcionan tu cuenta y
            las conexiones, qué debes tener en cuenta al utilizar las automatizaciones y
            cómo finalizar el servicio. Léelos junto con la{" "}
            <Link href="/privacidad">política de privacidad</Link>.
          </p>
        </div>
        <nav aria-label="Contenido de los términos de uso" className="mt-8 rounded-2xl border border-[var(--ms-line)] p-5">
          <h2 className="m-0 text-lg font-semibold">Contenido de estos términos</h2>
          <ol className="mb-0 mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <li><a href="#servicio">Qué es MarchaSolo</a></li>
            <li><a href="#cuenta-conexiones">Tu cuenta y tus conexiones</a></li>
            <li><a href="#uso-aceptable">Uso aceptable</a></li>
            <li><a href="#aprobaciones">Revisa antes de aprobar</a></li>
            <li><a href="#disponibilidad">Disponibilidad</a></li>
            <li><a href="#fin-servicio">Fin del servicio</a></li>
            <li><a href="#responsabilidad">Responsabilidad</a></li>
            <li><a href="#contacto">Contacto</a></li>
          </ol>
        </nav>

        <p>
          Estos términos establecen las condiciones de acceso y utilización de MarchaSolo, servicio ofrecido por {LEGAL.owner} (SIREN {LEGAL.siren}, {LEGAL.address}, {LEGAL.country}). La política de tratamiento de datos se detalla en la <Link href="/privacidad">política de privacidad</Link>.
        </p>

        <h2 id="servicio">1. Qué es MarchaSolo</h2>
        <p>
          Una aplicación de inteligencia artificial que conecta aplicaciones, coordina tareas y automatiza procesos. Las operaciones externas requieren aprobación, salvo las excepciones expresamente configuradas.
        </p>

        <h2 id="cuenta-conexiones">2. Tu cuenta y tus conexiones</h2>
        <ul>
          <li>Eres responsable de tu cuenta y de lo que hacen las personas a las que invitas a tus espacios.</li>
          <li>
            Conectas tus propias cuentas (correo, Google, mensajería…) y tu propia clave de IA. Los costos de esos servicios, incluido el
            consumo de la IA, se facturan en tus cuentas.
          </li>
          <li>Solo puedes conectar cuentas y datos que tengas derecho a usar.</li>
        </ul>

        <h2 id="uso-aceptable">3. Uso aceptable</h2>
        <p>
          No uses MarchaSolo para enviar comunicaciones no solicitadas, para actividades ilegales ni para acceder a datos de terceros sin
          permiso.
        </p>

        <h2 id="aprobaciones">4. Revisa antes de aprobar</h2>
        <p>
          La IA puede equivocarse. Revisa lo que MarchaSolo te propone antes de aprobarlo: lo que apruebas lo envías o lo escribes tú.
        </p>

        <h2 id="disponibilidad">5. Disponibilidad</h2>
        <p>
          MarchaSolo está en evolución. Intentamos que funcione de forma continua, pero puede haber interrupciones o cambios en sus
          funciones. Depende también de los servicios que conectas.
        </p>

        <h2 id="fin-servicio">6. Fin del servicio</h2>
        <p>
          Puedes dejar de usar MarchaSolo y pedir el borrado de tu cuenta cuando quieras escribiendo a{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Podemos suspender una cuenta que incumpla estos términos.
        </p>

        <h2 id="responsabilidad">7. Responsabilidad</h2>
        <p>
          En la medida que permita la ley, no respondemos de los daños indirectos derivados del uso de MarchaSolo ni de las acciones que
          apruebes. Nada de lo anterior limita los derechos que te reconoce la ley como consumidor.
        </p>

        <h2 id="contacto">8. Contacto</h2>
        <p>
          Para cualquier duda sobre estos términos, escribe a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>
      </main>
    </MarketingLayout>
  )
}
