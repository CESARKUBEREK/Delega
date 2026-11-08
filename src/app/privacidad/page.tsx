import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { LEGAL } from "@/lib/legal"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Política de privacidad",
  description: "Qué datos trata MarchaSolo, para qué, con quién se comparten y cómo ejercer tus derechos.",
  path: "/privacidad",
})

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
          El responsable del tratamiento es {LEGAL.owner} (SIREN {LEGAL.siren}), con domicilio en {LEGAL.address}, {LEGAL.country}. Para cualquier cuestión de privacidad, escribe a{" "}
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
                <strong>Google Contacts:</strong> si lo conectas, MarchaSolo busca en tus contactos (nombre, correo, teléfono, empresa y
                notas) para reconocer a quien te escribe y mostrarte su ficha, y crea contactos nuevos solo cuando lo apruebas. No modifica
                ni borra tus contactos y no guarda una copia de tu libreta.
              </li>
              <li>
                <strong>Redes sociales (Buffer):</strong> la lista de tus canales y las publicaciones que apruebas.
              </li>
              <li>
                <strong>Atención telefónica (Grok Voice):</strong> si la activas, el agente de voz de xAI que configuras atiende las
                llamadas de tu negocio. MarchaSolo recibe y guarda solo lo que el agente anota: nombre, teléfono, motivo y mensaje de quien
                llama, y las citas que reserva en tu calendario. No recibe ni guarda el audio de las llamadas; eso lo trata xAI según sus
                condiciones.
              </li>
              <li>
                <strong>Telegram y WhatsApp:</strong> los mensajes que recibe tu bot o tu número conectado, y los que envías con tu
                aprobación. En WhatsApp solo se leen los mensajes del número de empresa que conectas: nunca tu WhatsApp personal ni los
                grupos. Las notas de voz se transcriben y el audio no se guarda.
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
          Para elegir en cada tarea el modelo de IA más adecuado y económico, usamos también cifras de uso agregadas de todos los
          espacios: tipo de tarea, modelo, tokens, costo, tiempo de respuesta y si la tarea salió bien. Nunca el texto de tus mensajes,
          documentos o respuestas, ni datos que te identifiquen a ti o a tus clientes. La base legal es nuestro interés legítimo en que
          el servicio funcione mejor y cueste menos.
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
          <li>Solo usamos los datos de Google Drive, Google Calendar y Google Contacts para las funciones de MarchaSolo que tú ves y usas.</li>
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
            <strong>El proveedor de IA que tú conectas</strong> con tu propia clave (OpenAI, Anthropic, DeepSeek o xAI/Grok). Recibe el
            contenido necesario para cada tarea, bajo sus condiciones de uso de API. A OpenAI y a xAI les pedimos que no conserven las
            conversaciones. Anthropic
            no usa los datos de su API para entrenar modelos. DeepSeek procesa los datos fuera de la Unión Europea. El dictado por voz se
            transcribe con OpenAI.
          </li>
          <li>
            <strong>La prueba gratuita del onboarding:</strong> mientras no conectes tu IA, usamos OpenAI con una clave de MarchaSolo, con
            las mismas condiciones que arriba. Le enviamos la tarea que nos cuentas y, si nos das tu web, el texto de sus páginas públicas
            (como mucho dos propuestas). Si ejecutas tus automatizaciones con la prueba gratuita, recibe además lo que cada ejecución necesite leer
            (por ejemplo, los correos de tu bandeja), solo durante esa ejecución.
          </li>
          <li>
            <strong>Análisis de tu web:</strong> si nos das la dirección, descargamos sus páginas públicas. Cuando una página necesita un
            navegador para mostrarse, la abre por nosotros Browserless (Países Bajos). No pedimos ni usamos ninguna contraseña.
          </li>
          <li>
            <strong>Proveedores que hacen funcionar el servicio:</strong> Supabase (base de datos y funciones del servidor, en Estados
            Unidos, región de Oregón), Vercel (alojamiento de la web, con el servidor en Dublín) y Cloudflare (la comprobación
            antirrobots del acceso). Tratan los datos por cuenta nuestra y solo para prestar el servicio.
          </li>
          <li>
            <strong>Los servicios que conectas</strong> (Google, tu proveedor de correo, Telegram, Twilio o Meta Platforms para WhatsApp, Buffer para tus
            redes sociales, tu CRM…), para leer o enviar lo que pides.
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

        <h2>8. Cookies</h2>
        <p>
          Solo usamos cookies y almacenamiento del navegador necesarios para que el servicio funcione: mantener tu sesión iniciada,
          recordar el espacio en el que trabajas, volver al paso correcto después de conectar una cuenta, guardar durante 7 días tu
          avance en el onboarding y la comprobación antirrobots de Cloudflare al entrar. No usamos cookies de publicidad ni de
          analítica, así que no necesitamos pedirte consentimiento para ellas.
        </p>

        <h2>9. Tus derechos</h2>
        <p>
          Puedes pedir acceder a tus datos, corregirlos, borrarlos, llevártelos a otro servicio, limitar su uso u oponerte a él escribiendo
          a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Te responderemos en un plazo máximo de un mes. También puedes reclamar ante
          la CNIL (Commission nationale de l&apos;informatique et des libertés, en Francia) o ante la autoridad de protección de datos de
          tu país.
        </p>
        <p>
          <strong>Si vives en Argentina</strong>, se aplica además la Ley N° 25.326 de Protección de los Datos Personales. El titular de
          los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no
          inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso
          3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326,
          tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
          incumplimiento de las normas vigentes en materia de protección de datos personales.
        </p>

        <h2>10. Menores</h2>
        <p>MarchaSolo es una herramienta de trabajo y no está dirigida a menores de 18 años.</p>

        <h2>11. Cambios</h2>
        <p>
          Si cambiamos esta política, actualizaremos la fecha de arriba y, si el cambio es importante, te avisaremos en la aplicación.
          Consulta también los <Link href="/terminos">términos de uso</Link>.
        </p>
      </main>
    </MarketingLayout>
  )
}
