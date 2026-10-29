import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones para usar MarchaSolo.",
  robots: { index: true, follow: true },
}

export default function TermsPage() {
  return (
    <MarketingLayout>
      <main className="legal-page">
        <p className="app-eyebrow">LEGAL</p>
        <h1 className="rotulo">Términos de uso</h1>
        <p className="legal-updated">Última actualización: {LEGAL.updated}</p>

        <p>
          Estos términos regulan el uso de MarchaSolo, que ofrece {LEGAL.owner} ({LEGAL.country}). Al crear una cuenta los aceptas. Cómo
          tratamos tus datos se explica en la <Link href="/privacidad">política de privacidad</Link>.
        </p>

        <h2>1. Qué es MarchaSolo</h2>
        <p>
          Una aplicación que usa la inteligencia artificial para leer lo que conectas, proponerte planes y preparar acciones. Todo lo que
          escribe o envía en tu nombre espera tu aprobación.
        </p>

        <h2>2. Tu cuenta y tus conexiones</h2>
        <ul>
          <li>Eres responsable de tu cuenta y de lo que hacen las personas a las que invitas a tus espacios.</li>
          <li>
            Conectas tus propias cuentas (correo, Google, mensajería…) y tu propia clave de IA. Los costes de esos servicios, incluido el
            consumo de la IA, se facturan en tus cuentas.
          </li>
          <li>Solo puedes conectar cuentas y datos que tengas derecho a usar.</li>
        </ul>

        <h2>3. Uso aceptable</h2>
        <p>
          No uses MarchaSolo para enviar comunicaciones no solicitadas, para actividades ilegales ni para acceder a datos de terceros sin
          permiso.
        </p>

        <h2>4. Revisa antes de aprobar</h2>
        <p>
          La IA puede equivocarse. Revisa lo que MarchaSolo te propone antes de aprobarlo: lo que apruebas lo envías o lo escribes tú.
        </p>

        <h2>5. Disponibilidad</h2>
        <p>
          MarchaSolo está en evolución. Intentamos que funcione de forma continua, pero puede haber interrupciones o cambios en sus
          funciones. Depende también de los servicios que conectas.
        </p>

        <h2>6. Fin del servicio</h2>
        <p>
          Puedes dejar de usar MarchaSolo y pedir el borrado de tu cuenta cuando quieras escribiendo a{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Podemos suspender una cuenta que incumpla estos términos.
        </p>

        <h2>7. Responsabilidad</h2>
        <p>
          En la medida que permita la ley, no respondemos de los daños indirectos derivados del uso de MarchaSolo ni de las acciones que
          apruebes. Nada de lo anterior limita los derechos que te reconoce la ley como consumidor.
        </p>

        <h2>8. Contacto</h2>
        <p>
          Para cualquier duda sobre estos términos, escribe a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>
      </main>
    </MarketingLayout>
  )
}
