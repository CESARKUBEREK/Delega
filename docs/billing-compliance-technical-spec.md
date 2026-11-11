# MarchaSolo Billing & Compliance
## Especificación técnica funcional y de arquitectura

**Estado:** propuesta técnica para implementación  
**Versión:** 1.0 — 11 de noviembre de 2026  
**Operador contractual:** CYRANO SAS (SIREN 820 897 502)  
**Mercados previstos:** España/Unión Europea, Argentina y México  
**Cobro previsto:** tarjeta mediante proveedor externo  
**Stack objetivo:** Next.js, Supabase (Postgres, Auth, Edge Functions) y Vercel

> Esta especificación describe el sistema que debe construirse; no acredita que ya esté implementado. Las reglas jurídicas, fiscales y de consumo deben validarse profesionalmente por mercado antes de activar ventas.

---

## 1. Objetivo y principios

Construir un módulo central que convierta las obligaciones comerciales y legales de MarchaSolo en procesos verificables: contratación, consentimiento, pruebas, cobros, renovación, avisos, cambios de precio, pagos fallidos, cancelación, desistimiento/revocación, reembolsos, facturación, exportación y eliminación de datos.

Principios obligatorios:

1. **Servidor como autoridad:** el backend calcula importes, impuestos, permisos y transiciones. El navegador nunca declara un pago exitoso.
2. **Evidencia de consentimiento:** registrar texto/version/hash, fecha, usuario, finalidad y contexto; no basta un booleano.
3. **Idempotencia:** webhooks, cobros, reembolsos y jobs repetidos no duplican efectos.
4. **Trazabilidad:** todo cambio de estado, cobro, aviso y acción administrativa deja evidencia.
5. **Derechos separados:** cancelar renovación, desistir/revocar, pedir reembolso, cerrar cuenta y solicitar borrado son acciones diferentes.
6. **Privacidad por diseño:** minimizar datos, limitar acceso, cifrar secretos y definir retención.
7. **Proveedor intercambiable:** no acoplar el dominio de negocio a un proveedor de pagos.
8. **No almacenar datos de tarjeta:** PAN/CVV permanecen exclusivamente en el proveedor PCI.
9. **No prometer funciones inexistentes:** los textos legales reflejan solo capacidades activadas y probadas.

## 2. Alcance

### Incluido
- Catálogo de planes, precios, monedas, periodicidad, promociones e impuestos.
- Checkout, información precontractual y aceptación contractual.
- Pruebas gratuitas, conversión y suscripciones recurrentes.
- Renovación, cambios de plan/precio, cancelación y recuperación de pagos.
- Métodos de pago tokenizados, transacciones, reembolsos y conciliación.
- Webhooks verificados, facturas, recibos y notas de crédito.
- Documentos legales versionados y evidencia de consentimiento.
- Desistimiento UE y mecanismos de cancelación/revocación por jurisdicción.
- Solicitudes de acceso, exportación, rectificación y supresión.
- Desconexión de integraciones y revocación de credenciales.
- Consola interna, auditoría, métricas y alertas.

### Fuera de la primera versión
Contabilidad general, presentación automática de declaraciones, facturación electrónica integrada con todos los portales públicos, gestión integral de disputas bancarias, cobros por transferencia/efectivo/cripto y almacenamiento directo de tarjetas.

## 3. Arquitectura lógica

Componentes:
1. **Pricing & Offers:** catálogo, precios, promociones y elegibilidad.
2. **Checkout:** cotización, snapshot, consentimiento y sesión de pago.
3. **Subscription Engine:** estados, periodos, renovaciones, cambios y derechos de acceso.
4. **Payment Adapter:** interfaz agnóstica para pagos, tokenización, consultas, reembolsos y webhooks.
5. **Tax & Invoicing:** perfil fiscal, reglas tributarias, facturas y numeración.
6. **Legal Evidence:** documentos, versiones, consentimientos y prueba contractual.
7. **Policy Engine:** reglas por país, región, tipo de cliente, fecha y evento.
8. **Notification Engine:** plantillas, colas, programación y entrega.
9. **Rights & Requests:** cancelaciones, desistimientos, reembolsos y solicitudes de datos.
10. **Audit & Admin:** registro de eventos y consola interna.

Flujo:

    Web/App -> Next.js API -> Pricing/Policy -> Checkout/Consent
                                  |                  |
                                  v                  v
                              Supabase DB <---- Subscription Engine
                                  |                  |
                                  v                  v
                           Outbox / Scheduler -> Notifications
                                  |
                                  v
                           Payment Adapter <----> Payment Provider
                                  ^                    |
                                  +--- Verified Webhooks

Límites de confianza:
- El cliente web solo solicita acciones; el servidor vuelve a calcular y autorizar.
- Un webhook no es confiable hasta validar firma, timestamp, cuenta y entorno.
- Los jobs releen el estado actual antes de actuar.
- El proveedor confirma el resultado financiero; MarchaSolo mantiene el estado comercial reconciliado.
- Secretos solo en entorno servidor o Vault; nunca en navegador.

## 4. Modelo de datos

Todas las tablas operativas usan UUID, timestamps UTC, constraints e índices. Los importes son enteros en unidades menores, junto con moneda ISO 4217; nunca float.

| Tabla | Campos y propósito |
|---|---|
| billing_customers | user_id, workspace_id, nombre legal, email, tipo consumer/business, país, idioma, estado |
| tax_profiles | customer, país/región, razón social, dirección, ID fiscal, validación y evidencia |
| billing_plans | código estable, nombre, capacidades, estado, versión |
| plan_prices | plan, mercado, moneda, importe menor, intervalo, impuestos incluidos/excluidos, vigencia |
| promotions | código, descuento, duración, elegibilidad, límites y vigencia |
| checkout_sessions | customer, plan/precio, snapshot de cotización, expiración, estado, idempotency key |
| subscriptions | customer, plan/precio, proveedor/external id, estado, periodos, trial, cancelación programada |
| subscription_items | suscripción, concepto, cantidad, snapshot de precio y capacidades |
| subscription_changes | plan/precio anterior/nuevo, prorrateo, fecha efectiva, actor y motivo |
| payment_methods | customer, proveedor, token/reference, marca/últimos cuatro si están disponibles, vencimiento, default |
| payment_transactions | suscripción, checkout, proveedor, external id, importe, moneda, estado, idempotency key |
| payment_events | external event id único, tipo, payload minimizado, firma validada, estado de proceso |
| refunds | transacción, importe, motivo, estado, referencia externa, actor |
| invoices | customer, transacción, número/serie, moneda, base, impuestos, total, snapshots emisor/receptor y archivo |
| credit_notes | factura original, número, motivo, importes, archivo y estado |
| legal_documents | tipo, jurisdicción, idioma, versión, contenido/hash, vigencia |
| consent_records | usuario/customer/workspace, documento/version/hash, finalidad, acción, timestamp, contexto |
| notification_jobs | tipo, destinatario, plantilla/version, scheduled_at, dedupe_key, estado |
| notification_logs | job, canal, proveedor, resultado, fechas, error y provider id |
| cancellation_requests | suscripción, solicitante, tipo, motivo opcional, fecha solicitada/efectiva, estado |
| withdrawal_requests | contrato, consumidor, jurisdicción, recepción, plazo, consentimiento de inicio, decisión y reembolso |
| data_requests | titular, tipo, recepción, vencimiento, verificación, estado y evidencia |
| policy_rules | jurisdicción, tipo cliente, evento, vigencia, regla versionada y aprobación |
| audit_logs | actor, acción, recurso, cambios minimizados, correlation_id y timestamp |
| outbox_events | evento de dominio pendiente, agregado, payload mínimo, dedupe key y published_at |

Reglas:
- Guardar snapshots inmutables de precio, impuesto, emisor, receptor, plan y documento contractual.
- Los cambios futuros nunca alteran históricos.
- Los registros financieros no se borran en cascada; se anonimizan o conservan según obligación documentada.
- Unicidad para proveedor+external event id, proveedor+transaction id, idempotency key y serie+número de factura.
- No guardar PAN/CVV ni payloads innecesarios del proveedor.

## 5. Máquinas de estado

### Suscripción
Estados: incomplete, trialing, active, past_due, suspended, cancel_at_period_end, canceled, expired.

Transiciones:
- incomplete -> trialing | active | incomplete_expired
- trialing -> active | canceled | expired
- active -> past_due | cancel_at_period_end | canceled
- past_due -> active | suspended | canceled
- suspended -> active | canceled
- cancel_at_period_end -> active (revertir antes del fin) | canceled
- canceled y expired son terminales; una nueva contratación crea otra suscripción.

Toda transición valida estado actual en transacción, registra evento y publica efectos mediante outbox.

### Pago
created -> requires_action -> processing -> succeeded | failed | canceled.

### Reembolso
requested -> pending -> succeeded | failed. No cambiar el estado del pago original a negativo al reembolsarlo.

### Solicitud de derechos
received -> identity_check -> in_review -> approved | rejected -> completed.

Cada transición conserva actor, fundamento, fecha y comunicación.

## 6. Checkout y contratación

1. El usuario elige plan, país y tipo de cliente.
2. El backend obtiene precio vigente y calcula impuestos/elegibilidad.
3. Se crea una sesión con snapshot inmutable de importe, moneda, periodicidad, impuestos y total.
4. Antes de confirmar se muestra proveedor contractual, características/límites, precio total, periodicidad, renovación, siguiente cobro, cancelación, impuestos y documentos legales.
5. Consentimientos separados cuando corresponda: términos, pago recurrente/renovación, inicio inmediato del servicio y marketing opcional. Nunca premarcar casillas.
6. El botón final expresa inequívocamente la obligación de pago.
7. Guardar evidencia de documentos y consentimientos.
8. Activar acceso solo tras pago confirmado por backend/webhook o inicio válido de prueba.
9. Enviar confirmación duradera por email con precio, periodicidad, fecha de renovación, cancelación y documentos aplicables.

Permitir revisar/corregir datos antes de contratar. Si checkout expira, invalidar y recalcular.

## 7. Renovación, avisos y cambios de precio

- Cada suscripción conserva periodo actual y próxima fecha de cobro.
- Un job identifica renovaciones y crea eventos idempotentes.
- Policy Engine determina aviso, antelación y canal según jurisdicción y tipo de cliente.
- Registrar plantilla/version, destinatario, contenido/hash, fecha y resultado.
- Los avisos de cortesía no sustituyen los legalmente exigidos.
- Cambios de precio crean nueva versión. Nunca alteran contratos históricos.
- Antes de un aumento, determinar si requiere aviso, aceptación expresa o derecho de terminación. No aplicar hasta cumplirlo.
- El portal muestra precio actual, fecha de renovación y estado de cancelación.

## 8. Pagos fallidos y recuperación

1. Registrar el fallo de proveedor/webhook.
2. Pasar a past_due según regla.
3. Avisar causa disponible, importe, método de actualización y plazo.
4. Programar reintentos configurables.
5. Si el pago se confirma, volver a active y emitir recibo/factura.
6. Agotados los reintentos, suspender/cancelar solo tras avisos y periodos de gracia aplicables.
7. No borrar datos ni desconectar integraciones por el primer fallo.

Cada intento usa idempotency key y nunca repite un cobro confirmado.

## 9. Cancelación, desistimiento y reembolsos

### Cancelación ordinaria
- Disponible desde la cuenta, sin obligar a contactar soporte.
- Sin obstáculos, pasos engañosos ni retención coercitiva.
- Confirmar que la renovación se desactiva, fecha efectiva y acceso restante.
- Enviar confirmación por email y guardar evidencia.
- Una reactivación requiere nueva acción registrada.

### Desistimiento UE
- Identificar consumidores y contratos cubiertos.
- Mostrar plazo, procedimiento e información precontractual.
- Ofrecer formulario/modelo cuando sea exigible, sin excluir otros medios inequívocos.
- Registrar recepción.
- Separar la petición de inicio inmediato del servicio y el reconocimiento de consecuencias legales; nunca inferir consentimiento.
- Calcular reembolso/plazo según normativa y servicio prestado; escalar casos no automáticos.
- Guardar decisión, importe, medio y evidencia.

### Argentina y México
Crear perfiles de reglas separados para cancelación/revocación, información, confirmación y reembolso. No reutilizar el flujo UE. Activar solo tras validación jurídica local y versionar fecha de vigencia.

### Reembolsos
- Total/parcial con motivo y actor.
- Verificar saldo y estado del proveedor.
- Vincular al pago original.
- Crear nota de crédito/documento correctivo cuando proceda.
- Comunicar importe, fecha y referencia.
- Reembolsos excepcionales con permiso administrativo reforzado.

## 10. Facturación e impuestos

- Emisor contractual/fiscal: CYRANO SAS, con datos legales validados.
- El cálculo fiscal considera país, tipo de cliente, ID fiscal, ubicación, producto, moneda, fecha y reglas vigentes.
- No asumir una tasa global ni que todas las ventas llevan IVA francés.
- Mantener adapter para proveedor de facturación; proveedor aún por seleccionar.
- Numeración por serie legal/ejercicio, transaccional y no reutilizable.
- Factura con emisor, cliente, identificadores, fecha, número, concepto, periodo, moneda, base, impuesto, total y menciones aplicables.
- Una factura emitida no se edita: se corrige mediante nota de crédito/documento rectificativo.
- PDF en bucket privado y URLs firmadas temporales.
- Portal cliente para descarga; consola interna para búsqueda/exportación autorizada.
- Matriz fiscal de España/UE, Argentina y México aprobada por asesor fiscal antes de activar cada mercado.

## 11. Privacidad y ciclo de vida de datos

Conectar con la política de privacidad y DPA. Capturar solo datos necesarios. Admitir acceso, exportación, rectificación, oposición/restricción y supresión cuando corresponda.

Flujo de borrado:
1. Verificar identidad y registrar solicitud.
2. Bloquear nuevas operaciones según proceda.
3. Resolver suscripción conforme a la elección/derecho.
4. Revocar tokens y desconectar integraciones.
5. Exportar datos cuando se solicite y sea procedente.
6. Eliminar datos operativos no sujetos a retención.
7. Anonimizar lo que deba conservarse por obligación legal.
8. Comunicar resultado y excepciones con base/plazo.

No prometer borrado total inmediato ni eliminar registros financieros legalmente conservables. Cifrar tokens, redactar logs y definir retención por categoría/país.

## 12. Seguridad, RLS y permisos

Roles:
- customer_owner: gestiona facturación del workspace.
- customer_billing: consulta facturas, método de pago y suscripción.
- workspace_member: sin acceso fiscal/financiero salvo permiso.
- support_agent: lectura limitada/enmascarada; sin reembolsos.
- billing_admin: gestiona suscripciones, facturas y reembolsos según permiso.
- super_admin: acceso excepcional, MFA y auditoría.

RLS:
- Activar RLS en todas las tablas expuestas.
- Basar acceso en pertenencia verificada al workspace y permiso de facturación.
- Webhooks, secretos, reglas, auditoría y jobs no accesibles directamente por anon/authenticated.
- Service role solo en servidor y con autorización explícita.
- Nunca confiar en workspace_id del navegador.
- Pruebas negativas obligatorias entre workspaces.

## 13. API interna propuesta

| Método/ruta | Función |
|---|---|
| GET /api/billing/catalog | Planes y precios visibles por país/moneda |
| POST /api/billing/checkout | Crear checkout y snapshot |
| GET /api/billing/subscription | Consultar suscripción del workspace |
| POST /api/billing/subscription/cancel | Solicitar cancelación |
| POST /api/billing/subscription/resume | Revertir cancelación si procede |
| POST /api/billing/payment-method/setup | Alta/cambio de método tokenizado |
| POST /api/billing/withdrawal | Registrar desistimiento/revocación |
| POST /api/billing/data-requests | Crear solicitud de derechos |
| GET /api/billing/invoices | Listar facturas autorizadas |
| GET /api/billing/invoices/:id/download | Descargar mediante URL firmada |
| POST /api/webhooks/payments/:provider | Verificar y procesar evento |
| POST /api/internal/billing/reconcile | Conciliación protegida |
| POST /api/internal/billing/refunds | Reembolso con permiso elevado |

Todas las mutaciones autenticadas salvo webhook verificado. Validar esquemas, autorización y límites. Responder con request_id, estado y fecha efectiva; nunca exponer secretos.

## 14. Eventos y notificaciones

Eventos mínimos:
checkout.created/completed, consent.recorded, subscription.trial_started/activated/renewal_due/renewed/plan_changed/price_change_proposed/cancel_requested/cancel_scheduled/canceled/expired/suspended, payment.succeeded/failed/retry_scheduled/method_updated, refund.requested/succeeded, invoice.issued, credit_note.issued, withdrawal.received/completed, data_request.received/completed.

Plantillas:
- contratación y copia de términos;
- inicio/fin de prueba y fecha/importe del primer cobro;
- pago y factura;
- aviso de renovación exigido;
- propuesta de cambio de precio;
- pago fallido, actualización de método y suspensión;
- cancelación solicitada/confirmada;
- desistimiento/revocación recibida/resuelta;
- reembolso/nota de crédito;
- solicitud y finalización de derechos;
- cambios legales cuando requieran comunicación.

Motor:
- Plantillas versionadas por idioma/jurisdicción.
- Cola con reintentos exponenciales, dead-letter y alertas.
- Dedupe por evento+destinatario+plantilla+versión.
- Email transaccional inicial; marketing separado.
- Un envío fallido no extingue obligación: reintentar y alertar.

## 15. Policy Engine jurisdiccional

Reglas versionadas por país/región, tipo de cliente, plan, evento, fecha de vigencia, aviso/antelación, canal, plazo, contenido/documentos, acceso, reembolso, escalado humano, referencia jurídica y aprobador.

Las reglas para España/UE, Argentina y México se cargan inicialmente como pendientes de aprobación. No activar automáticamente consecuencias jurídicas sin validación. Debe existir matriz aprobada por asesoría local antes de habilitar cobros recurrentes en cada mercado.

## 16. Consola de administración CYRANO SAS

Secciones: resumen (MRR, altas, renovaciones, fallos, bajas, reembolsos); clientes/perfiles fiscales; suscripciones/timeline; transacciones/conciliación; métodos tokenizados; facturas/notas de crédito; cancelaciones/desistimientos; solicitudes de privacidad; consentimientos/documentos; notificaciones fallidas; reglas/plantillas; auditoría/exportaciones.

Acciones sensibles requieren motivo, permiso específico y audit log. Reembolsos de importe alto pueden exigir doble aprobación configurable.

## 17. Jobs y resiliencia

Jobs: renovaciones/facturas; avisos; finalización de cancelaciones; reintentos; expiración de checkout/trial; notificaciones; conciliación; detección de webhooks pendientes; vencimientos de solicitudes; alertas de plazos legales.

Usar scheduler seguro (Supabase Cron o Vercel Cron autenticado), locks/leases, idempotency keys, límites de concurrencia y registro. Conciliación diaria compara estados externos/locales y crea incidencias; nunca corrige silenciosamente.

## 18. Observabilidad

Métricas: conversión checkout/pago, renovación, fallos/recuperación, bajas por plan/país, reembolsos, latencia de webhook, edad de eventos pendientes, entregabilidad, solicitudes próximas a vencer y discrepancias.

Alertas: firmas inválidas en volumen, evento financiero sin procesar, importe/moneda discrepante, posible cobro duplicado, factura ausente, plazo legal vencido, email legal rechazado, conciliación fallida y acceso RLS anómalo.

## 19. Pruebas

- Unitarias: precios/impuestos, reglas, transiciones, fechas e idempotencia.
- Integración: checkout, webhooks, fallos, reintentos, reembolsos y facturas.
- Contract tests para cada adapter.
- RLS: aislamiento de workspaces y roles.
- Seguridad: firma inválida, replay, payload manipulado, escalada, CSRF y filtración de secretos.
- E2E: alta, trial, renovación, cancelación, desistimiento, fallo, exportación y borrado.
- Reloj controlado para plazos/avisos.
- Multi-moneda, redondeos, eventos duplicados/fuera de orden/retrasados.
- Solo tarjetas/datos sandbox en pruebas.

## 20. Criterios de aceptación

1. Precio, moneda, periodicidad e impuestos calculados en backend y mostrados antes del pago.
2. Evidencia exacta de documentos y consentimientos.
3. Ningún dato completo de tarjeta almacenado por MarchaSolo.
4. Webhooks inválidos rechazados y duplicados inocuos.
5. Acceso solo tras pago confirmado o trial válido.
6. Renovación y factura una sola vez.
7. Avisos en plazo/canal/idioma aplicables y con evidencia.
8. Cancelación desde cuenta desactiva renovación y confirma fecha efectiva.
9. Desistimiento/revocación aplica reglas aprobadas y registra resolución/reembolso.
10. Recuperación de fallos sin borrar datos.
11. Facturas/notas inmutables, numeradas y descargables.
12. Matriz legal/fiscal aprobada por mercado.
13. Solicitudes de datos con vencimiento y evidencia.
14. Revocación/eliminación desconecta integraciones y elimina/anonimiza según retención.
15. RLS/RBAC pasan pruebas negativas.
16. Toda acción sensible queda auditada.
17. Conciliación detecta discrepancias sin corrección silenciosa.
18. Textos legales describen solo funciones desplegadas.

## 21. Plan de implementación

**Fase 0 — Descubrimiento:** inventariar esquema Supabase, Auth, planes y permisos; elegir proveedor de pagos y facturación; confirmar países, monedas, precios, trial, reglas legales/fiscales, email transaccional.

**Fase 1 — Fundaciones:** migraciones SQL, enums, constraints, índices, RLS; pricing, checkout snapshot, documentos/consentimientos; Payment Adapter; webhook inbox, outbox e idempotencia.

**Fase 2 — Suscripciones/pagos:** máquina de estados, checkout, trial, cobros, renovación, método de pago, fallos, reintentos, cancelación, conciliación y auditoría.

**Fase 3 — Comunicaciones/derechos:** Notification Engine, plantillas, Policy Engine, desistimiento/revocación, reembolsos, notas de crédito, exportación, eliminación y desconexión.

**Fase 4 — Facturación/consola:** Tax Adapter, emisión documental, portal cliente, consola interna, permisos y reportes.

**Fase 5 — Validación/activación:** pruebas, seguridad, revisión jurídica/fiscal, activación progresiva por país/plan, métricas y runbooks.

## 22. Decisiones que bloquean producción

1. Proveedor de pagos compatible con CYRANO SAS, países, monedas, suscripciones, SCA/3DS, reembolsos y webhooks.
2. Proveedor/estrategia de facturación y archivo fiscal.
3. Países y monedas exactos de lanzamiento y precios.
4. Duración del trial y momento del primer cobro.
5. Prorrateo de cambios de plan.
6. Reintentos, plazos de gracia y suspensión.
7. Proveedor de email transaccional y dominio remitente.
8. Retención financiera y de datos.
9. Reglas legales/fiscales aprobadas para España/UE, Argentina y México.
10. Atención de reclamaciones y escalado humano.

**Regla de salida:** no activar contratación recurrente en un mercado hasta que pagos, avisos, cancelación, derechos del consumidor, facturación, privacidad y textos legales estén implementados y probados de extremo a extremo.


---

## 23. Alineación con la fundación de billing existente

**Actualización:** 11 de noviembre de 2026.

La implementación de la fundación ya existe en DOrkesta mediante `supabase/migrations/20261111163700_billing_foundation.sql`. Esta especificación funcional debe leerse junto con el plan técnico de implementación:

[`docs/payment-orchestrator-implementation-plan.md`](./payment-orchestrator-implementation-plan.md).

La fundación existente incluye `billing_plans`, `plan_prices`, `billing_customers`, `legal_documents`, `checkout_sessions`, `subscriptions`, `payment_transactions`, `payment_events`, `consent_records`, `billing_audit_events` y `outbox_events`. La capa de derechos de uso también debe reutilizar `workspace_usage_periods` y las capacidades de `billing_plans`.

Por tanto, las entidades de este documento que describen esas mismas responsabilidades son el modelo funcional de referencia, no instrucciones para crear tablas duplicadas. Las entidades complementarias (por ejemplo, reembolsos, facturas, notas de crédito, mapeo de clientes de proveedor y conciliación) se implementarán solo cuando la fase correspondiente las necesite y después de verificar que no exista ya una equivalente.

La integración inicial se realizará con Stripe en sandbox. Mercado Pago Argentina y México permanecerán deshabilitados hasta que se confirme la elegibilidad contractual y de liquidación de CYRANO SAS. No se activarán cobros reales como parte de la actualización documental.
