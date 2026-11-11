import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { LEGAL } from "@/lib/legal"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Términos y condiciones",
  description: `Condiciones de contratación y uso de MarchaSolo, servicio ofrecido por ${LEGAL.owner}.`,
  path: "/terminos",
})

const sections = [
  ["proveedor", "1. Proveedor e identificación"],
  ["alcance", "2. Ámbito de aplicación y aceptación"],
  ["servicio", "3. Descripción del servicio"],
  ["cuenta", "4. Registro, cuenta y espacios de trabajo"],
  ["planes", "5. Planes, suscripciones y precios"],
  ["prueba", "6. Pruebas gratuitas y promociones"],
  ["pagos", "7. Pagos y facturación"],
  ["renovacion", "8. Renovación automática"],
  ["cancelacion", "9. Cancelación de la suscripción"],
  ["desistimiento", "10. Desistimiento, revocación y reembolsos"],
  ["impago", "11. Pagos rechazados y suspensión por impago"],
  ["terceros", "12. Servicios y aplicaciones de terceros"],
  ["propiedad", "13. Propiedad intelectual de MarchaSolo"],
  ["contenidos", "14. Contenidos y datos del cliente"],
  ["modelos", "15. Modelos de inteligencia artificial"],
  ["automatizaciones", "16. Responsabilidad sobre las automatizaciones"],
  ["acciones", "17. Acciones automatizadas y aprobaciones"],
  ["disponibilidad", "18. Disponibilidad, mantenimiento y cambios"],
  ["suspension", "19. Suspensión y terminación de cuentas"],
  ["datos", "20. Exportación, conservación y eliminación de datos"],
  ["privacidad", "21. Protección de datos personales"],
  ["responsabilidad", "22. Responsabilidad y limitaciones"],
  ["reclamaciones", "23. Reclamaciones e indemnizaciones"],
  ["cambios", "24. Modificaciones de estos términos"],
  ["ley", "25. Ley aplicable y resolución de controversias"],
  ["generales", "26. Disposiciones generales"],
  ["contacto", "27. Contacto"],
] as const

export default function TermsPage() {
  return (
    <MarketingLayout>
      <main className="legal-page">
        <p className="app-eyebrow">CONDICIONES DEL SERVICIO</p>
        <h1 className="rotulo">Términos y condiciones</h1>
        <p className="legal-updated">Última actualización: {LEGAL.updated}</p>

        <div className="mt-6 rounded-2xl border border-[var(--ms-line)] bg-[var(--ms-white)] p-5">
          <h2 className="m-0 text-lg font-semibold">Información importante</h2>
          <p className="mb-0 mt-2">
            Estos términos regulan el acceso y uso de MarchaSolo y, cuando corresponda, la contratación de planes de pago.
            Identifican al proveedor, explican las reglas de suscripción y describen los derechos y responsabilidades de ambas partes.
            Léelos junto con la <Link href="/privacidad">política de privacidad</Link>.
          </p>
        </div>

        <nav aria-label="Índice de los términos y condiciones" className="mt-8 rounded-2xl border border-[var(--ms-line)] p-5">
          <h2 className="m-0 text-lg font-semibold">Contenido</h2>
          <ol className="mb-0 mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {sections.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
          </ol>
        </nav>

        <h2 id="proveedor">1. Proveedor e identificación</h2>
        <p>
          MarchaSolo es un servicio operado y ofrecido por {LEGAL.owner}, sociedad constituida en Francia, identificada con SIREN {LEGAL.siren},
          con domicilio en {LEGAL.address}, {LEGAL.country} (en adelante, “MarchaSolo”, “nosotros” o el “Proveedor”).
          El correo de contacto es <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>
        <p>
          MarchaSolo se dirige a usuarios de España y otros países de la Unión Europea, Argentina y México, sin perjuicio de que
          la disponibilidad de determinadas funciones o planes pueda variar por país. La contratación puede realizarse por
          consumidores, profesionales y empresas. La condición de consumidor se determinará conforme a la legislación aplicable
          y no únicamente por la opción seleccionada en el registro.
        </p>

        <h2 id="alcance">2. Ámbito de aplicación y aceptación</h2>
        <p>
          Estos términos se aplican al sitio web, la aplicación, las cuentas, los espacios de trabajo, las automatizaciones y los
          servicios de MarchaSolo. Al crear una cuenta, acceder o contratar un plan, el usuario declara que ha podido consultar
          estos términos. La contratación de un plan de pago requiere una aceptación expresa antes de confirmar el pedido.
        </p>
        <p>
          Si actúas en nombre de una empresa u organización, declaras que tienes facultades suficientes para vincularla.
          Si no estás de acuerdo con estos términos, no debes utilizar el servicio. Las condiciones particulares que se acuerden
          por escrito prevalecerán únicamente en aquello que regulen expresamente.
        </p>

        <h2 id="servicio">3. Descripción del servicio</h2>
        <p>
          MarchaSolo es una plataforma que permite conectar aplicaciones y servicios, organizar información, coordinar tareas y
          configurar automatizaciones para reducir trabajo repetitivo. Según el plan, las integraciones disponibles y la configuración
          de cada cuenta, el servicio puede incluir asistentes, flujos de trabajo, ejecución de tareas, avisos y procesamiento de información.
        </p>
        <p>
          Las funciones, límites, integraciones y capacidades concretas son las que se muestran en el sitio y en la cuenta en el
          momento de contratar. No todas las integraciones o funciones están necesariamente disponibles en todos los países o planes.
          Podemos ofrecer funciones experimentales o beta, que se identificarán como tales y podrán tener limitaciones adicionales.
        </p>

        <h2 id="cuenta">4. Registro, cuenta y espacios de trabajo</h2>
        <ul>
          <li>Debes proporcionar información veraz, mantenerla actualizada y proteger tus credenciales de acceso.</li>
          <li>Eres responsable de las actividades realizadas desde tu cuenta, salvo que se deban a una causa que legalmente no te sea imputable.</li>
          <li>Debes notificarnos sin demora cualquier acceso no autorizado o incidente de seguridad del que tengas conocimiento.</li>
          <li>Si invitas a otras personas a un espacio de trabajo, debes contar con autoridad para hacerlo y gestionar sus permisos.</li>
          <li>No debes compartir credenciales de forma insegura ni intentar acceder a cuentas, espacios o datos ajenos.</li>
        </ul>
        <p>
          El administrador del espacio de trabajo es responsable de asignar permisos adecuados y de informar a sus miembros sobre
          las reglas internas aplicables. Las acciones de cada miembro se atribuirán a su cuenta para fines de seguridad y auditoría.
        </p>

        <h2 id="planes">5. Planes, suscripciones y precios</h2>
        <p>
          MarchaSolo puede ofrecer planes gratuitos y de pago. Las características, límites de uso, precio, moneda, periodicidad,
          impuestos y condiciones específicas se muestran antes de contratar y forman parte de la oferta aceptada. En caso de
          contradicción, prevalece la información específica del pedido confirmado para esa suscripción.
        </p>
        <p>
          Los precios se muestran en la moneda indicada en el proceso de contratación. Salvo que se indique expresamente lo contrario,
          los impuestos aplicables se añadirán o desglosarán conforme a la normativa correspondiente. El precio y las condiciones
          aceptados quedarán asociados a la contratación.
        </p>
        <p>
          Las funciones o límites de un plan pueden variar entre planes. Los cambios de plan solicitados por el cliente se aplicarán
          en la fecha y con el ajuste de precio que se informe antes de confirmar el cambio. Cualquier prorrateo, crédito o cargo
          adicional se mostrará antes de ejecutarlo.
        </p>

        <h2 id="prueba">6. Pruebas gratuitas y promociones</h2>
        <p>
          Cuando se ofrezca una prueba gratuita o promoción, se indicarán su duración, elegibilidad, funciones incluidas y condiciones
          de conversión. Si la prueba requiere registrar una tarjeta y se convierte automáticamente en una suscripción de pago,
          el importe, la periodicidad y la fecha del primer cobro deberán comunicarse claramente antes de aceptar.
        </p>
        <p>
          El usuario puede cancelar antes de la conversión cuando esa posibilidad se ofrezca en el proceso de contratación. Las
          promociones no son acumulables salvo que se indique lo contrario y pueden estar sujetas a límites razonables para evitar
          usos abusivos. No se reducirán derechos legales de consumidores mediante una promoción.
        </p>

        <h2 id="pagos">7. Pagos y facturación</h2>
        <p>
          Los planes de pago se abonan mediante los medios de tarjeta que se habiliten en el proceso de contratación. El pago se
          procesa a través de un proveedor externo. MarchaSolo no solicita ni almacena el número completo de la tarjeta ni su código
          de seguridad; esos datos se introducen directamente en los componentes seguros del proveedor de pagos.
        </p>
        <p>
          Al contratar una suscripción recurrente, autorizas los cargos correspondientes al precio, la periodicidad y los impuestos
          informados en el pedido, hasta que la suscripción termine o la autorización sea revocada conforme a estos términos y la ley.
          El proveedor de pagos puede aplicar mecanismos de autenticación reforzada o verificación de operaciones.
        </p>
        <p>
          CYRANO SAS es el proveedor contractual y emitirá los documentos de facturación que correspondan, directamente o mediante
          un proveedor especializado. Las facturas y recibos reflejarán los datos disponibles y las menciones exigidas por la normativa
          fiscal aplicable. Es tu responsabilidad facilitar datos de facturación correctos y comunicar sus cambios.
        </p>
        <p>
          El tratamiento fiscal puede variar según el país, la condición de consumidor o empresa, la localización y la naturaleza
          de la operación. La información fiscal mostrada en el checkout y en la factura será la aplicable a la operación concreta.
          No debes utilizar datos fiscales de terceros ni identificadores incorrectos.
        </p>

        <h2 id="renovacion">8. Renovación automática</h2>
        <p>
          Salvo que el pedido indique otra cosa, las suscripciones de pago se renuevan automáticamente por periodos sucesivos de
          igual duración al periodo inicial. Antes de confirmar la contratación se informarán el importe, la periodicidad y, cuando
          corresponda, la fecha del primer cargo y las condiciones de renovación.
        </p>
        <p>
          La renovación se cobrará al método de pago registrado. La autorización de pago se mantiene hasta la cancelación efectiva
          de la suscripción. Cuando la legislación aplicable exija un aviso previo de renovación, de vencimiento o de cambio, se
          facilitará dentro del plazo y por el medio exigidos. Los avisos informativos que podamos enviar adicionalmente no sustituyen
          los avisos legalmente obligatorios.
        </p>
        <p>
          Si proponemos modificar el precio o una condición esencial de la suscripción, comunicaremos el cambio con la antelación
          exigida y explicaremos, cuando corresponda, cómo rechazarlo o finalizar la suscripción antes de su aplicación. No aplicaremos
          un cambio que requiera aceptación expresa sin obtenerla.
        </p>

        <h2 id="cancelacion">9. Cancelación de la suscripción</h2>
        <p>
          Puedes solicitar la cancelación de la renovación desde los controles de tu cuenta cuando estén disponibles o mediante
          una solicitud a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. La cancelación ordinaria impide futuras renovaciones
          desde la fecha efectiva que se indique; no implica necesariamente el reembolso de importes ya cobrados.
        </p>
        <p>
          Si cancelas durante un periodo ya pagado, podrás seguir utilizando las funciones contratadas hasta el final de ese periodo,
          salvo que el pedido o una norma imperativa establezcan otra cosa. La confirmación deberá indicar si la cancelación es
          inmediata o al final del periodo, la fecha efectiva y el efecto sobre el acceso.
        </p>
        <p>
          La cancelación de una suscripción no equivale por sí sola al cierre de la cuenta, al borrado de datos ni al ejercicio de
          un derecho de desistimiento o revocación. Esas solicitudes se tramitan por separado.
        </p>

        <h2 id="desistimiento">10. Desistimiento, revocación y reembolsos</h2>
        <p>
          Si contratas como consumidor, conservas los derechos de desistimiento, revocación, arrepentimiento, resolución y reembolso
          que te reconozca la legislación imperativa de tu país. Las condiciones y plazos pueden variar según el país, el tipo de
          contrato y si el servicio digital ha comenzado o se ha ejecutado.
        </p>
        <p>
          Para los consumidores de la Unión Europea, cuando resulte aplicable el derecho de desistimiento en contratos a distancia,
          el plazo general legal es de catorce días desde la celebración del contrato de servicios, sujeto a las reglas y excepciones
          legales. En servicios digitales o contenido digital, la pérdida o limitación de ese derecho solo podrá producirse cuando
          se cumplan los requisitos legales de información, solicitud expresa, consentimiento y reconocimiento que correspondan.
          No consideraremos que has renunciado a un derecho por el mero hecho de utilizar la plataforma.
        </p>
        <p>
          Puedes comunicar el desistimiento o una solicitud de revocación a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>,
          indicando los datos necesarios para identificar la contratación. También puedes utilizar cualquier formulario o mecanismo
          que la ley exija o que pongamos a disposición. Te confirmaremos la recepción por un medio duradero cuando corresponda.
        </p>
        <p>
          Los reembolsos se efectuarán dentro del plazo legal aplicable, utilizando en principio el mismo medio de pago, salvo acuerdo
          válido en contrario. Si la ley permite descontar el valor proporcional de un servicio iniciado a petición expresa del
          consumidor, se calculará y explicará de forma transparente. No se limitarán derechos de reembolso por esta cláusula.
        </p>
        <p>
          Para Argentina, México y otros países, se aplicarán los mecanismos, plazos y efectos de revocación o cancelación que establezca
          la legislación local. Cuando una solicitud requiera valoración individual, podremos pedir información razonablemente necesaria,
          sin retrasar indebidamente el ejercicio del derecho.
        </p>

        <h2 id="impago">11. Pagos rechazados y suspensión por impago</h2>
        <p>
          Si un cargo es rechazado, podremos solicitar que actualices el método de pago y realizar nuevos intentos conforme a las
          reglas comunicadas y a las posibilidades del proveedor. Te informaremos del importe pendiente y de las medidas que podrían
          adoptarse si el impago continúa.
        </p>
        <p>
          Si el pago sigue pendiente tras los avisos y plazos aplicables, podremos limitar o suspender las funciones de pago, o
          finalizar la suscripción, siempre de forma proporcional y respetando los derechos legales. Un fallo de pago no autoriza
          por sí solo a eliminar tus datos ni a ignorar una solicitud de desistimiento o reclamación pendiente.
        </p>

        <h2 id="terceros">12. Servicios y aplicaciones de terceros</h2>
        <p>
          MarchaSolo puede conectarse con servicios de terceros, como correo electrónico, almacenamiento, calendarios, mensajería,
          CRM, bases de datos, proveedores de modelos y otras aplicaciones. Cada tercero mantiene sus propios términos, políticas,
          disponibilidad, precios y medidas de seguridad.
        </p>
        <p>
          Tú decides qué servicios conectar y debes contar con los permisos y autorizaciones necesarios. La conexión puede requerir
          conceder permisos de acceso específicos. Revisa esos permisos y revócalos cuando ya no sean necesarios. MarchaSolo no
          controla las modificaciones, interrupciones, decisiones ni políticas independientes de esos proveedores.
        </p>
        <p>
          Los costes cobrados directamente por terceros, incluidos los consumos de modelos, mensajería, almacenamiento o APIs bajo
          cuentas propias del cliente, no están incluidos en el precio de MarchaSolo salvo indicación expresa. Los costes que MarchaSolo
          facture como parte de un plan se identificarán en la oferta correspondiente.
        </p>

        <h2 id="propiedad">13. Propiedad intelectual de MarchaSolo</h2>
        <p>
          MarchaSolo y sus elementos —incluidos software, diseño, marcas, interfaces, documentación y contenidos propios— pertenecen
          al Proveedor o a sus licenciantes y están protegidos por las normas de propiedad intelectual e industrial. Estos términos
          no transfieren su titularidad.
        </p>
        <p>
          Mientras cumplas estos términos y mantengas una suscripción válida cuando sea necesaria, te concedemos una licencia limitada,
          no exclusiva, no sublicenciable y revocable para utilizar el servicio con fines propios o internos de tu actividad, dentro
          de las funciones contratadas. No puedes copiar, revender, descompilar, explotar ni poner a disposición el servicio fuera de
          lo permitido por la ley o por una autorización escrita.
        </p>

        <h2 id="contenidos">14. Contenidos y datos del cliente</h2>
        <p>
          Conservas los derechos sobre los datos, documentos, instrucciones, mensajes y demás contenidos que introduzcas o conectes
          (“Contenido del Cliente”). Nos autorizas a alojarlos, transmitirlos, organizarlos y procesarlos únicamente en la medida
          necesaria para prestar, proteger y mantener el servicio, cumplir obligaciones legales y ejecutar tus instrucciones.
        </p>
        <p>
          Declaras que tienes derechos y bases legales suficientes para aportar esos contenidos y permitir su tratamiento. No debes
          cargar información ilícita, datos obtenidos sin autorización ni información sensible salvo que la función esté diseñada
          para ello y exista una base legal adecuada.
        </p>
        <p>
          No utilizaremos el Contenido del Cliente para fines incompatibles con la prestación del servicio. El tratamiento de datos
          personales se rige además por la política de privacidad y, cuando corresponda, por un acuerdo de tratamiento de datos.
        </p>

        <h2 id="modelos">15. Modelos de inteligencia artificial</h2>
        <p>
          Algunas funciones pueden utilizar modelos de inteligencia artificial propios o de proveedores externos. Sus resultados
          son probabilísticos y pueden contener errores, omisiones, sesgos o información desactualizada. No garantizamos que un
          resultado generado sea exacto, completo, original o adecuado para una finalidad concreta.
        </p>
        <p>
          Cuando conectes una cuenta o clave de un proveedor externo, su uso también estará sujeto a las condiciones de ese proveedor.
          Debes revisar la configuración, los permisos y las condiciones de tratamiento de datos del modelo elegido. No introduzcas
          información que no estés autorizado a compartir.
        </p>
        <p>
          Los resultados no constituyen asesoramiento jurídico, médico, financiero, fiscal ni profesional. Debes verificarlos antes
          de tomar decisiones o utilizarlos en contextos donde un error pueda producir consecuencias relevantes.
        </p>

        <h2 id="automatizaciones">16. Responsabilidad sobre las automatizaciones</h2>
        <p>
          Eres responsable de configurar las automatizaciones de acuerdo con tus instrucciones, permisos, obligaciones legales y
          procesos internos. Antes de activar un flujo, debes comprobar sus disparadores, condiciones, destinatarios, datos utilizados,
          frecuencia y efectos previsibles.
        </p>
        <p>
          Debes asegurarte de contar con autorización para enviar comunicaciones, acceder a datos, modificar registros o ejecutar
          acciones en los sistemas conectados. Eres responsable de cumplir las normas sobre privacidad, comunicaciones comerciales,
          conservación documental, propiedad intelectual y cualquier regulación aplicable a tu actividad.
        </p>
        <p>
          Debes establecer controles adecuados para operaciones sensibles, como pagos, compromisos contractuales, decisiones sobre
          personas, comunicaciones masivas o eliminación de información. No configures automatizaciones que eludan controles legales,
          medidas de seguridad o restricciones de terceros.
        </p>

        <h2 id="acciones">17. Acciones automatizadas y aprobaciones</h2>
        <p>
          Las acciones que MarchaSolo puede ejecutar dependen de la integración, los permisos concedidos y la configuración del flujo.
          Algunas acciones pueden requerir revisión o aprobación humana; otras pueden ejecutarse automáticamente si esa modalidad está
          disponible y ha sido configurada por el usuario.
        </p>
        <p>
          Antes de habilitar una ejecución automática, debes comprender qué acción se realizará, bajo qué condiciones y con qué
          consecuencias. Cuando exista una opción de aprobación, puedes utilizarla como control adicional. La ausencia de una
          solicitud de aprobación no significa que MarchaSolo haya verificado la legalidad o conveniencia de la acción.
        </p>
        <p>
          Debes supervisar los flujos y detener o modificar aquellos que produzcan resultados inesperados. Podemos limitar una
          ejecución cuando detectemos riesgos de seguridad, abuso, incumplimiento o daños a terceros.
        </p>

        <h2 id="disponibilidad">18. Disponibilidad, mantenimiento y cambios</h2>
        <p>
          Procuramos ofrecer un servicio fiable, pero no garantizamos disponibilidad ininterrumpida ni ausencia absoluta de errores.
          Puede haber interrupciones por mantenimiento, incidencias técnicas, redes, integraciones o proveedores externos.
        </p>
        <p>
          Podemos corregir, actualizar o modificar funciones para mejorar seguridad, rendimiento o utilidad. Si un cambio afecta
          de forma sustancial a una prestación contratada, informaremos con la antelación razonable o legalmente exigida y respetaremos
          los derechos de terminación o compensación que correspondan.
        </p>
        <p>
          Nada de esta cláusula excluye garantías o derechos imperativos sobre conformidad, continuidad o actualización de servicios
          digitales que correspondan a consumidores.
        </p>

        <h2 id="suspension">19. Suspensión y terminación de cuentas</h2>
        <p>
          Podemos suspender o limitar temporalmente una cuenta cuando sea razonablemente necesario para proteger el servicio, a otros
          usuarios o a terceros; cumplir una orden legal; investigar un incidente de seguridad; evitar fraude; o responder a un
          incumplimiento material de estos términos.
        </p>
        <p>
          Cuando sea posible y no comprometa la seguridad ni una investigación, te informaremos de los motivos y de las medidas
          necesarias para corregir el incumplimiento. La terminación definitiva se reservará para supuestos justificados, incluidos
          incumplimientos graves o reiterados. Podrás contactar con nosotros para solicitar revisión.
        </p>
        <p>
          Puedes dejar de utilizar el servicio y solicitar el cierre de tu cuenta. La finalización no elimina obligaciones de pago
          ya devengadas ni derechos de reembolso que sigan vigentes.
        </p>

        <h2 id="datos">20. Exportación, conservación y eliminación de datos</h2>
        <p>
          Puedes solicitar acceso o exportación de los datos disponibles de tu cuenta mediante las herramientas habilitadas o
          escribiendo a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. La disponibilidad de formatos y el alcance de la
          exportación dependerán de la naturaleza de los datos, de los derechos de terceros y de las obligaciones legales.
        </p>
        <p>
          Tras el cierre de la cuenta, eliminaremos o dejaremos de utilizar los datos operativos conforme a la política de privacidad
          y a los plazos de conservación aplicables. Algunos registros podrán conservarse durante el tiempo necesario para cumplir
          obligaciones fiscales, contables, de seguridad, prevención del fraude o defensa de reclamaciones. Cuando corresponda,
          se bloquearán o anonimizarán para otros usos.
        </p>
        <p>
          La desconexión de una aplicación puede requerir revocar también los permisos desde el servicio externo. La eliminación
          de datos de MarchaSolo no elimina copias que permanezcan en sistemas de terceros bajo su propio control.
        </p>

        <h2 id="privacidad">21. Protección de datos personales</h2>
        <p>
          El tratamiento de datos personales se describe en la <Link href="/privacidad">política de privacidad</Link>, que forma
          parte del marco contractual de uso del servicio. Allí se explican las finalidades, bases jurídicas, destinatarios,
          transferencias, plazos y derechos aplicables.
        </p>
        <p>
          Cuando utilices MarchaSolo para tratar datos personales de los que eres responsable, podrás tener obligaciones propias
          frente a las personas afectadas. Cuando corresponda legalmente, las partes formalizarán un acuerdo de tratamiento de datos
          que regule las instrucciones, medidas de seguridad, subencargados y asistencia.
        </p>
        <p>
          Para consultas o solicitudes relacionadas con privacidad, puedes escribir a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
        </p>

        <h2 id="responsabilidad">22. Responsabilidad y limitaciones</h2>
        <p>
          Ninguna disposición excluye o limita una responsabilidad que no pueda excluirse o limitarse conforme a la ley aplicable,
          incluidos el dolo, la culpa grave cuando corresponda, daños personales, incumplimientos esenciales o derechos imperativos
          de consumidores.
        </p>
        <p>
          En la medida permitida por la ley, no seremos responsables por daños derivados de información incorrecta proporcionada
          por el cliente, configuraciones realizadas por este, uso contrario a las instrucciones, indisponibilidad de servicios
          de terceros o decisiones adoptadas sin verificar resultados automatizados. Esta previsión no elimina nuestra responsabilidad
          por incumplimientos que nos sean legalmente imputables.
        </p>
        <p>
          Para clientes que actúen exclusivamente en el marco de su actividad profesional o empresarial, y en la máxima medida
          permitida por la ley, la responsabilidad total del Proveedor por reclamaciones relacionadas con el servicio durante los
          doce meses anteriores al hecho generador se limitará a las cantidades efectivamente pagadas por ese cliente a MarchaSolo
          durante ese periodo. Este límite no se aplica a consumidores ni a responsabilidades legalmente no limitables.
        </p>
        <p>
          No respondemos por lucro cesante, pérdida indirecta de oportunidades o daños consecuenciales en relaciones B2B, salvo
          cuando la ley aplicable impida esa exclusión. El cliente debe mantener copias de seguridad razonables de la información
          crítica y controles apropiados sobre sus sistemas.
        </p>

        <h2 id="reclamaciones">23. Reclamaciones e indemnizaciones</h2>
        <p>
          Si consideras que el servicio no cumple lo contratado, ponte en contacto con nosotros describiendo el problema y aportando
          la información necesaria para investigarlo. Procuraremos responder en un plazo razonable y ofrecer una solución conforme
          al contrato y a la legislación aplicable.
        </p>
        <p>
          En la medida permitida por la ley, si tu uso ilícito del servicio, el contenido que aportas o el incumplimiento de estos
          términos genera una reclamación de un tercero contra nosotros, deberás cooperar razonablemente en su defensa y responder
          por los daños directamente causados por tu incumplimiento. Esta obligación no cubre daños causados por nuestra propia
          conducta ni limita derechos imperativos de consumidores.
        </p>

        <h2 id="cambios">24. Modificaciones de estos términos</h2>
        <p>
          Podemos actualizar estos términos por cambios legales, de seguridad, técnicos o del servicio. Publicaremos la versión
          vigente e indicaremos su fecha de actualización. Cuando un cambio afecte de manera material a tus derechos u obligaciones,
          te lo comunicaremos con la antelación exigida y, cuando la ley lo requiera, solicitaremos tu aceptación o te permitiremos
          terminar la relación sin penalización.
        </p>
        <p>
          Los cambios no modificarán retroactivamente las condiciones de operaciones ya realizadas ni reducirán derechos adquiridos.
          Si no aceptas un cambio que requiera aceptación, podrás dejar de utilizar la función afectada o finalizar la suscripción
          conforme a las opciones y derechos que correspondan.
        </p>

        <h2 id="ley">25. Ley aplicable y resolución de controversias</h2>
        <p>
          Para clientes profesionales y empresariales, estos términos se regirán, en principio, por el derecho francés, sin perjuicio
          de las normas imperativas que resulten aplicables. Las controversias se someterán a los tribunales competentes conforme
          a las reglas legales aplicables.
        </p>
        <p>
          Si eres consumidor, la elección del derecho francés no te priva de la protección que te otorguen las disposiciones
          imperativas de la legislación de tu país de residencia habitual cuando esas normas resulten aplicables. Tampoco limita
          las reglas de competencia judicial que protegen a los consumidores.
        </p>
        <p>
          Antes de iniciar una acción, puedes escribirnos para intentar resolver la controversia. También puedes acudir a los
          organismos de consumo, mecanismos de resolución alternativa o autoridades competentes disponibles en tu país.
        </p>

        <h2 id="generales">26. Disposiciones generales</h2>
        <p>
          Si alguna disposición se considera inválida o inaplicable, las restantes conservarán su vigencia en la medida permitida
          por la ley. La falta de ejercicio de un derecho no implica renuncia a él. No puedes ceder tu cuenta o contrato sin nuestro
          consentimiento, salvo que la ley permita otra cosa. Podemos transferir el contrato en el marco de una reorganización o
          transmisión del negocio, respetando los derechos y obligaciones legales.
        </p>
        <p>
          Estos términos, la información del pedido, la política de privacidad y los acuerdos particulares aplicables constituyen
          el marco contractual relativo al servicio. En caso de contradicción, se interpretarán de forma compatible y prevalecerán
          las normas imperativas de protección del usuario o consumidor.
        </p>

        <h2 id="contacto">27. Contacto</h2>
        <p>
          Para consultas sobre el servicio, contratación, pagos, cancelaciones, reembolsos o estos términos, contacta con
          <a href={`mailto:${LEGAL.email}`}> {LEGAL.email}</a>.
        </p>
        <p>
          <strong>{LEGAL.owner}</strong><br />
          SIREN {LEGAL.siren}<br />
          {LEGAL.address}, {LEGAL.country}
        </p>
      </main>
    </MarketingLayout>
  )
}
