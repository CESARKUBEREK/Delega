import type { Metadata } from "next"
import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { LEGAL } from "@/lib/legal"

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos trata MarchaSolo, para qué, con quién se comparten y cómo ejercer tus derechos.",
  robots: { index: true, follow: true },
}

// Política de privacidad pública. Google la revisa al verificar la app:
// debe describir con exactitud el uso de los datos de las API de Google.
export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <main className="legal-page">
        <p className="app-eyebrow">LEGAL</p>
        <h1 className="rotulo">Política de privacidad</h1>
        <p className="legal-updated">Última actualización: {LEGAL.updated}</p>

        <p>
          MarchaSolo es una aplicación que te ayuda a automatizar tareas de tu negocio: lee lo que tú le conectas, te propone planes y
          prepara acciones que <strong>siempre esperan tu aprobación</strong> antes de escribir o enviar nada. Esta política explica qué
          datos trata, para qué y cómo puedes controlarlos.
        </p>

        <h2>1. Responsable</h2>
        <p>
          El responsable del tratamiento es {LEGAL.owner} ({LEGAL.country}). Para cualquier cuestión de privacidad, escribe a{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>

        <h2>2. Qué datos tratamos</h2>
        <ul>
          <li>
            <strong>Tu cuenta:</strong> correo electrónico, nombre si lo indicas, y los espacios de trabajo a los que perteneces.
          </li>
          <li>
            <strong>Lo que conectas tú.</strong> Cada conexión es de tu espacio y usa tu propia cuenta del servicio:
            <ul>
              <li>
                <strong>Correo (IMAP):</strong> los mensajes de tu bandeja de entrada que MarchaSolo importa para clasificarlos y preparar
                respuestas, y los que envías con tu aprobación.
              </li>
              <li>
                <strong>Google Drive:</strong> solo los archivos y carpetas que eliges expresamente en el selector de Google (permiso{" "}
                <code>drive.file</code>). MarchaSolo no ve el resto de tu Drive.
              </li>
              <li>
                <strong>Google Calendar:</strong> tus eventos, para responder a consultas sobre tu agenda y crear o cambiar eventos cuando
                lo apruebas.
              </li>
              <li>
                <strong>Telegram y WhatsApp:</strong> los mensajes que recibe tu bot o tu número conectado, y los que envías con tu
                aprobación.
              </li>
              <li>
                <strong>Otras herramientas</strong> que conectes (CRM, inmobiliaria, contabilidad, bases de datos o APIs propias): los
                datos que lees o escribes en ellas desde una automatización.
              </li>
            </ul>
          </li>
          <li>
            <strong>Lo que creas en MarchaSolo:</strong> tus conversaciones con el asistente, las notas de voz que dictas (se transcriben y
            no se guarda el audio), tus automatizaciones y el registro de sus ejecuciones.
          </li>
          <li>
            <strong>Claves y permisos:</strong> las claves de API de tu IA y los permisos de acceso de cada servicio, guardados cifrados.
            Nadie, ni siquiera tú, puede volver a verlos.
          </li>
          <li>
            <strong>Datos técnicos:</strong> registros de funcionamiento y de errores, y el consumo de IA (tokens) de cada petición.
          </li>
        </ul>

        <h2>3. Para qué los usamos</h2>
        <p>
          Solo para darte las funciones que tú pides: leer y ordenar tu bandeja, responder a tus preguntas, preparar y ejecutar tus
          automatizaciones, y mostrarte lo que hace cada una. No vendemos tus datos, no los usamos para publicidad y no creamos perfiles
          con ellos.
        </p>

        <p>
          Base legal: tratamos tus datos para prestarte el servicio que contratas al crear la cuenta (ejecución del contrato), para
          mantenerlo seguro y evitar abusos (interés legítimo) y, cuando la ley lo exige, con tu consentimiento, que puedes retirar en
          cualquier momento desconectando el servicio correspondiente.
        </p>

        <h2 id="google">4. Datos de las API de Google</h2>
        <p>
          El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google se ajustan a la{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">
            Política de datos de usuario de los servicios de API de Google
          </a>
          , incluidos los requisitos de uso limitado (<em>Limited Use</em>). En concreto:
        </p>
        <ul>
          <li>Solo usamos los datos de Google Drive y Google Calendar para las funciones de MarchaSolo que tú ves y usas.</li>
          <li>
            Solo los transferimos a terceros cuando es necesario para darte esas funciones (por ejemplo, al proveedor de IA que tú eliges
            para preparar una respuesta), por motivos de seguridad o para cumplir la ley.
          </li>
          <li>No los usamos para publicidad, no los vendemos y no los usamos para entrenar modelos de IA generales.</li>
          <li>
            Ninguna persona los lee, salvo que tú lo autorices expresamente para un caso concreto, que sea necesario por seguridad o que lo
            exija la ley.
          </li>
        </ul>
        <p>
          Puedes retirar el acceso cuando quieras desde Integraciones («Desconectar», que también revoca el permiso en Google) o desde{" "}
          <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer" target="_blank">
            los permisos de tu cuenta de Google
          </a>
          .
        </p>

        <h2>5. Con quién se comparten</h2>
        <ul>
          <li>
            <strong>El proveedor de IA que tú conectas</strong> con tu propia clave (OpenAI, Anthropic o DeepSeek). Recibe el contenido
            necesario para cada tarea, bajo sus condiciones de uso de API. A OpenAI le pedimos que no conserve las conversaciones. Anthropic
            no usa los datos de su API para entrenar modelos. DeepSeek procesa los datos fuera de la Unión Europea. El dictado por voz se
            transcribe con OpenAI.
          </li>
          <li>
            <strong>Proveedores que hacen funcionar el servicio:</strong> Supabase (base de datos y funciones del servidor, en Estados
            Unidos) y Vercel (alojamiento de la web). Tratan los datos por cuenta nuestra y solo para prestar el servicio.
          </li>
          <li>
            <strong>Los servicios que conectas</strong> (Google, tu proveedor de correo, Telegram, Twilio para WhatsApp, tu CRM…), para leer
            o enviar lo que pides.
          </li>
        </ul>
        <p>
          Algunos de estos proveedores están fuera del Espacio Económico Europeo. En esos casos, las transferencias se apoyan en las
          garantías previstas por la ley, como las cláusulas contractuales tipo de la Comisión Europea.
        </p>

        <h2>6. Cuánto tiempo los conservamos</h2>
        <ul>
          <li>Mientras tengas la cuenta, salvo lo que borres antes.</li>
          <li>
            Los mensajes de la bandeja se pueden borrar automáticamente tras el plazo que elijas en sus ajustes. Se borran de MarchaSolo, no
            de tu buzón ni de Telegram.
          </li>
          <li>Al desconectar un servicio se borran su conexión y sus permisos; en Google, además, se revoca el acceso.</li>
          <li>
            Si pides borrar tu cuenta, borramos tu espacio personal y todo lo que contiene. Los registros técnicos de funcionamiento se
            eliminan según los plazos de nuestros proveedores de infraestructura.
          </li>
        </ul>

        <h2>7. Seguridad</h2>
        <p>
          Todo viaja cifrado (HTTPS). Las claves y los permisos de acceso se guardan cifrados. Cada espacio está aislado del resto: las
          reglas de la base de datos solo dejan ver los datos de un espacio a sus miembros.
        </p>

        <h2>8. Tus derechos</h2>
        <p>
          Puedes pedir acceder a tus datos, corregirlos, borrarlos, llevártelos a otro servicio, limitar su uso u oponerte a él escribiendo
          a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Te responderemos en un plazo máximo de un mes. También puedes reclamar ante
          la CNIL (Commission nationale de l&apos;informatique et des libertés, en Francia) o ante la autoridad de protección de datos de
          tu país.
        </p>

        <h2>9. Menores</h2>
        <p>MarchaSolo es una herramienta de trabajo y no está dirigida a menores de 18 años.</p>

        <h2>10. Cambios</h2>
        <p>
          Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos en la aplicación.
          Consulta también los <Link href="/terminos">términos de uso</Link>.
        </p>
      </main>
    </MarketingLayout>
  )
}
