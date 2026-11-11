import Link from "next/link"
import { MarketingLayout } from "@/components/marketing-layout"
import { LEGAL } from "@/lib/legal"
import { publicPageMetadata } from "@/lib/seo"

export const metadata = publicPageMetadata({
  title: "Términos y condiciones",
  description: `Condiciones de contratación y uso de MarchaSolo en España, Argentina y México, ofrecido por ${LEGAL.owner}.`,
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
          MarchaSolo ofrece sus servicios comercialmente en España, Argentina y México. La contratación puede realizarse por consumidores,
          profesionales y empresas establecidos o residentes en esos territorios, según la disponibilidad indicada en el sitio web.
          La condición de consumidor se determinará conforme a la legislación aplicable y no únicamente por la opción seleccionada
          durante el registro. La sociedad proveedora está constituida en Francia; ello no supone que Francia sea un mercado de
          comercialización de MarchaSolo ni excluye las normas imperativas que protejan a los usuarios de los territorios atendidos.
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
          Cuando la contratación de pago esté habilitada, el único medio de pago aceptado por MarchaSolo será la tarjeta bancaria,
          procesada por un proveedor externo. Los datos completos de la tarjeta y su código de seguridad serán introducidos y
          tratados por los componentes seguros de dicho proveedor; MarchaSolo no los solicitará ni almacenará. Mientras el checkout
          y el proveedor de pagos no estén habilitados, no será posible contratar ni efectuar cobros a través del sitio.
        </p>
        <p>
          El consentimiento para los cobros recurrentes deberá ser expreso, informado y separado de cualquier aceptación genérica de
          estos términos. Antes de confirmar el pedido se mostrarán de forma clara y destacada el importe total, la moneda,
          la periodicidad, la fecha del primer cobro y la existencia de renovaciones automáticas. El proveedor de pagos podrá
          aplicar mecanismos de autenticación o verificación de operaciones. No se iniciarán cargos recurrentes sin ese consentimiento.
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
          Salvo que el pedido indique otra cosa, las suscripciones de pago se renovarán automáticamente por periodos sucesivos de igual
          duración. Antes de contratar se informarán el importe, la moneda, la periodicidad, la fecha del primer cargo y las condiciones
          de renovación. El consentimiento expreso para los cargos recurrentes quedará registrado y podrá consultarse.
        </p>
        <p>
          Para consumidores en México, MarchaSolo enviará un aviso de renovación con al menos cinco días naturales de anticipación,
          indicando el importe y la fecha del próximo cargo, y permitirá cancelar sin penalización antes de la renovación. Para
          consumidores en España, se facilitará cualquier aviso previo que exija la normativa aplicable o que se haya ofrecido
          expresamente como condición de contratación. En Argentina, se respetarán las reglas de información, consentimiento y
          cancelación aplicables a los cargos recurrentes. Estos avisos se enviarán por un medio de contacto electrónico asociado
          a la cuenta o por otro medio duradero acordado.
        </p>
        <p>
          Si proponemos modificar el precio o una condición esencial de la suscripción, comunicaremos el cambio con la antelación
          exigida y explicaremos, cuando corresponda, cómo rechazarlo o finalizar la suscripción antes de su aplicación. No aplicaremos
          un cambio que requiera aceptación expresa sin obtenerla.
        </p>

        <h2 id="cancelacion">9. Cancelación de la suscripción</h2>
        <p>
          Puedes cancelar la suscripción desde un mecanismo sencillo, visible y accesible en tu cuenta, cuando la contratación se haya
          realizado en línea, o mediante el canal legalmente exigido en tu país. La cancelación deberá poder completarse sin
          llamadas, negociaciones ni obstáculos desproporcionados. También puedes solicitarla a
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. La cancelación ordinaria impedirá nuevos cargos desde la fecha
          efectiva que se indique, sin perjuicio de los derechos de reembolso o desistimiento que correspondan.
        </p>
        <p>
          Si cancelas durante un periodo ya pagado, podrás seguir utilizando las funciones contratadas hasta el final de ese periodo,
          salvo que el pedido o una norma imperativa establezcan otra cosa. La confirmación deberá indicar si la cancelación es
          inmediata o al final del periodo, la fecha efectiva y el efecto sobre el acceso.
        </p>
        <p>
          La cancelación de una suscripción no equivale por sí sola al cierre de la cuenta ni al borrado de datos. Sin embargo, cuando
          la legislación aplicable reconozca un derecho de baja o revocación mediante un mecanismo específico, la solicitud se
          tramitará por ese mecanismo y no se condicionará a cerrar la cuenta.
        </p>

        <h2 id="desistimiento">10. Desistimiento, revocación y reembolsos</h2>
        <p>
          Si contratas como consumidor, conservas todos los derechos de desistimiento, arrepentimiento, revocación, resolución y reembolso
          reconocidos por las normas imperativas de tu país. Los procedimientos que siguen resumen los derechos generales y no
          sustituyen ni reducen una protección más favorable que resulte aplicable.
        </p>
        <p>
          Para consumidores en España, en los contratos a distancia el plazo general de desistimiento es de catorce días naturales desde
          la celebración del contrato de servicios. Si solicitas que el servicio comience durante ese plazo, podremos pedirte una
          solicitud expresa. Cuando la ley permita que el derecho se extinga por la ejecución completa del servicio o por el suministro
          de contenido digital no prestado en soporte material, recabaremos previamente el consentimiento expreso y el reconocimiento
          de que puedes perder ese derecho en las condiciones legales. Si desistes después de haber solicitado expresamente el inicio,
          pero antes de la ejecución completa, solo podrá exigirse el importe proporcional permitido por la ley y debidamente informado.
          No utilizaremos casillas premarcadas ni presumiremos una renuncia por el mero uso del servicio.
        </p>
        <p>
          En Argentina, los consumidores podrán ejercer el derecho de arrepentimiento dentro del plazo legal de diez días corridos desde
          la contratación del servicio, cuando resulte aplicable conforme al artículo 34 de la Ley 24.240 y al artículo 1.110 del
          Código Civil y Comercial. MarchaSolo pondrá a simple vista, en lugar destacado y desde el primer acceso, un enlace denominado
          “Botón de arrepentimiento” que permita solicitar la revocación. No se exigirá registración previa ni trámites adicionales
          para iniciar la solicitud. Podrán aplicarse únicamente verificaciones razonables de identidad y seguridad, por medios
          habituales y sin convertirlas en obstáculos. Dentro de las veinticuatro horas siguientes se informará el código de
          identificación de la solicitud y se adoptarán las medidas necesarias para tramitarla. Se respetarán las excepciones legales,
          incluidas las relativas a servicios efectivamente utilizados o consumidos cuando procedan.
        </p>
        <p>
          En Argentina, MarchaSolo también pondrá a simple vista, en lugar destacado y desde el primer acceso, un enlace denominado
          “Botón de baja de servicio” para solicitar la cancelación de servicios contratados a distancia. No se exigirá registración
          previa ni trámites adicionales para iniciar la baja. Se comunicará el código de solicitud dentro de las veinticuatro horas
          siguientes y se tramitará la baja conforme a la normativa aplicable.
        </p>
        <p>
          En México, los consumidores podrán cancelar de manera inmediata y sencilla las suscripciones o membresías con cobro
          recurrente, sin penalización por ejercer ese derecho. Se respetará el consentimiento expreso e informado para los cargos
          automáticos y el aviso de renovación con al menos cinco días naturales de anticipación previsto en el apartado 8.
        </p>
        <p>
          Los reembolsos se efectuarán dentro del plazo legal aplicable, utilizando en principio el mismo medio de pago, salvo acuerdo
          válido en contrario. Si la ley permite descontar el valor proporcional de un servicio iniciado a petición expresa del
          consumidor, se calculará y explicará de forma transparente. No se limitarán derechos de reembolso por esta cláusula.
        </p>
        <p>
          En todos los territorios, los reembolsos se efectuarán dentro del plazo legal aplicable y, en principio, mediante el mismo medio
          de pago, salvo acuerdo válido en contrario. No se limitarán derechos de reembolso por esta cláusula. En caso de duda,
          prevalecerá la norma de protección al consumidor más favorable que resulte imperativamente aplicable.
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
          Para las relaciones con clientes que actúen exclusivamente en el marco de su actividad profesional o empresarial, estos términos
          se regirán por el derecho francés, en la medida permitida por las normas imperativas aplicables. Las controversias se
          someterán a los tribunales que resulten competentes conforme a las reglas legales de jurisdicción y competencia. Esta
          elección no pretende atribuir competencia exclusiva a un tribunal cuando la ley disponga otra cosa.
        </p>
        <p>
          Si resides habitualmente en España, Argentina o México y contratas como consumidor, la elección del derecho francés no te privará
          de la protección que te otorguen las disposiciones imperativas de la legislación que resulte aplicable a tu contrato.
          Tampoco limita las reglas imperativas sobre jurisdicción, competencia judicial, reclamaciones administrativas ni acceso
          a mecanismos de resolución de controversias de tu país.
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
