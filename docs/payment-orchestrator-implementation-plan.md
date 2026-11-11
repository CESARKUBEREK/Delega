# Payment Orchestrator — especificación alineada con el billing existente

**Versión:** 1.1  
**Fecha:** 11 de noviembre de 2026  
**Repositorio:** `CESARKUBEREK/Delega`  
**Base de datos:** Supabase DOrkesta (`xgbmpziocflgsszzgyeb`)  
**Operador:** CYRANO SAS  
**Mercados objetivo:** España (EUR), Argentina (ARS), México (MXN)

> Este documento sustituye cualquier propuesta de crear un segundo conjunto de tablas de billing. La implementación debe ampliar la fundación existente de Billing & Compliance y mantenerla como única fuente de verdad comercial.

## 1. Decisión de arquitectura

MarchaSolo ya dispone de una fundación de facturación creada mediante `20261111163700_billing_foundation.sql`. Se reutilizan sus entidades y se añade únicamente lo que falta para integrar proveedores y completar operaciones financieras.

**No crear** tablas paralelas llamadas `billing_subscriptions`, `billing_payments`, `billing_events`, `billing_consents` ni `billing_customers`: ya existen las entidades correspondientes.

El proveedor externo procesa el pago; MarchaSolo mantiene la autoridad sobre planes, suscripciones, acceso, consentimiento y estado comercial. El navegador nunca activa una suscripción por una URL de retorno. Solo una confirmación verificada del proveedor (o un trial interno válido) puede provocar la activación.

## 2. Inventario existente que debe reutilizarse

| Entidad existente | Responsabilidad | Decisión |
|---|---|---|
| `billing_plans` | Catálogo y capacidades | Reutilizar; no duplicar capacidades en el adaptador |
| `plan_prices` | Precio por mercado, moneda e intervalo | Reutilizar y cargar precios aprobados ES/AR/MX |
| `billing_customers` | Perfil de facturación por workspace | Reutilizar; no crear un segundo perfil |
| `legal_documents` | Documentos contractuales versionados | Reutilizar |
| `checkout_sessions` | Snapshot de precio/cotización, expiración e idempotencia | Reutilizar; añadir referencias del proveedor mediante migración aditiva |
| `subscriptions` | Estado comercial, proveedor, external subscription id y periodos | Reutilizar |
| `payment_transactions` | Intentos/transacciones, importe, moneda, proveedor e idempotencia | Reutilizar |
| `payment_events` | Inbox de webhooks, deduplicación y procesamiento | Reutilizar |
| `consent_records` | Evidencia de aceptación vinculada al checkout/documento | Reutilizar |
| `billing_audit_events` | Auditoría de operaciones sensibles | Reutilizar |
| `outbox_events` | Entrega asíncrona y deduplicada de notificaciones/eventos | Reutilizar |
| `workspace_usage_periods` | Periodos de uso y límites vinculados a billing | Reutilizar; no crear otro motor de entitlement |

La auditoría del esquema encontró las tablas de checkout, suscripción, transacciones, eventos y consentimientos sin registros de operación en el momento de la consulta. El catálogo tiene tres planes y seis precios iniciales GLOBAL/USD. Estos importes no constituyen la tarifa local aprobada para los tres mercados.

### Campos ya existentes relevantes

- `plan_prices`: `market_code`, `currency`, `amount_minor`, `interval_unit`, `interval_count`, `valid_from`, `valid_until`, `active`.
- `billing_customers`: `workspace_id`, `owner_user_id`, `customer_type`, datos fiscales/dirección, `country_code`, `billing_email`, `preferred_language`.
- `checkout_sessions`: `billing_customer_id`, `plan_price_id`, `amount_minor`, `currency`, `quote_snapshot`, `idempotency_key`, `expires_at`, `status`.
- `subscriptions`: `billing_customer_id`, `plan_id`, `plan_price_id`, `provider`, `provider_subscription_id`, `status`, `currency`, `amount_minor`, periodos y cancelación.
- `payment_transactions`: `subscription_id`, `checkout_session_id`, `provider`, `provider_payment_id`, `status`, `amount_minor`, `currency`, `idempotency_key`, resultado.
- `payment_events`: `provider`, `provider_event_id`, `event_type`, `payload`, `signature_valid`, `processing_status`, `attempts`, `last_error`.
- `consent_records`: `checkout_session_id`, `legal_document_id`, `document_version`, `document_sha256`, `purpose`, `decision`, `context`, `recorded_at`.

## 3. Proveedores y habilitación por mercado

| Mercado | Proveedor previsto | Moneda de cargo | Estado inicial |
|---|---|---|---|
| España | Stripe | EUR | Integrar primero en sandbox |
| Argentina | Mercado Pago Argentina | ARS | Deshabilitado hasta aprobación contractual |
| México | Mercado Pago México | MXN | Deshabilitado hasta aprobación contractual |

La cuenta Stripe debe poder contratarse y liquidar a nombre de CYRANO SAS. Para Mercado Pago se debe confirmar por separado elegibilidad de la sociedad francesa, titularidad, requisitos fiscales/documentales, moneda, liquidación y recurrencia. No inferir que una cuenta local de un tercero resuelve esta condición.

### Configuración de proveedores

En la primera versión, la configuración no secreta de enrutamiento se mantendrá en código/configuración validada por servidor y los secretos en variables de entorno de Vercel. No crear una tabla genérica de proveedores antes de necesitar configuración administrable.

Cada adaptador tendrá:
- `enabled` por mercado y entorno.
- `eligibility_status` controlado por despliegue/configuración.
- lista de monedas y operaciones soportadas.
- credenciales solo de servidor.
- modo sandbox/production independiente.

Regla de seguridad: producción requiere simultáneamente proveedor habilitado y elegibilidad contractual aprobada. Los adaptadores MP permanecen deshabilitados por defecto.

## 4. Payment Orchestrator

Crear un módulo de dominio independiente del SDK de cada proveedor:

```text
src/lib/billing/
  providers/
    types.ts
    registry.ts
    stripe/
      adapter.ts
      webhook.ts
    mercadopago-ar/
      adapter.ts
      webhook.ts
    mercadopago-mx/
      adapter.ts
      webhook.ts
  orchestrator.ts
  pricing.ts
  checkout.ts
  subscriptions.ts
  payment-events.ts
  errors.ts
```

Ajustar la estructura a convenciones existentes del repositorio antes de crear directorios duplicados. No colocar lógica financiera en componentes React.

### Contrato común

```ts
type ProviderCode = "stripe" | "mercadopago_ar" | "mercadopago_mx";

type ProviderOperation =
  | "checkout"
  | "recurring"
  | "cancel"
  | "refund"
  | "retrieve";

interface PaymentProvider {
  readonly code: ProviderCode;
  readonly country: "ES" | "AR" | "MX";
  readonly currencies: readonly string[];

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  retrievePayment(providerPaymentId: string): Promise<ProviderPayment>;
  retrieveSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(
    providerSubscriptionId: string,
    mode: "immediate" | "period_end"
  ): Promise<ProviderCancellation>;
  refund(input: ProviderRefundInput): Promise<ProviderRefund>;
  verifyWebhook(request: Request): Promise<VerifiedProviderEvent>;
}
```

No asumir que los tres proveedores implementan exactamente las mismas capacidades. El registry debe comprobar capacidades antes de ofrecer una operación. Si una función no está soportada, devolver error tipado `provider_capability_not_supported`; nunca simular éxito.

El Orchestrator:
1. autentica usuario y valida rol owner/admin del workspace;
2. obtiene país y perfil de facturación del registro autorizado;
3. resuelve el precio activo en `plan_prices`;
4. verifica que mercado, moneda y proveedor coincidan;
5. calcula el importe en servidor y crea snapshot;
6. registra checkout e idempotency key;
7. solicita checkout al adaptador;
8. guarda referencias externas y URL de checkout;
9. devuelve solo los datos de redirección necesarios.

No aceptar del navegador importe, moneda, proveedor, plan_price_id sin volver a validar su vigencia y pertenencia.

## 5. Cambios de esquema estrictamente necesarios

### Migración A — referencias de proveedor y configuración de checkout

Añadir de forma aditiva a `checkout_sessions`:
- `provider` (nullable hasta asignación);
- `provider_checkout_id` (nullable);
- `checkout_url` (nullable; validar que no contenga secretos);
- `provider_metadata` JSONB con allowlist de metadatos no sensibles, default objeto.

Crear índice único parcial para (`provider`, `provider_checkout_id`) cuando ambos no sean null.

No guardar tokens, secretos, PAN/CVV ni payloads completos del proveedor en estas columnas. El snapshot debe preservar precio, moneda, periodicidad, país/mercado, versión legal y datos necesarios para reconstruir la contratación.

### Migración B — mapeo de cliente en proveedores

Crear `billing_provider_customers` solo porque un `billing_customer` puede necesitar identificadores distintos por proveedor y entorno:

- `id` UUID;
- `billing_customer_id` FK a `billing_customers`;
- `provider`;
- `provider_customer_id`;
- `environment` (sandbox/production);
- `created_at`, `updated_at`.

Unicidad por proveedor + entorno + provider_customer_id, e índice por billing_customer_id + proveedor + entorno. RLS sin acceso directo del cliente; operaciones mediante servidor autorizado.

### Migración C — reembolsos

Crear `payment_refunds` (no `refunds` si el repositorio ya adoptó este prefijo) con:
- FK a `payment_transactions`;
- proveedor y referencia externa;
- importe en unidades menores y moneda;
- estado requested/pending/succeeded/failed;
- motivo, actor, idempotency key;
- timestamps y error normalizado.

Un reembolso no convierte la transacción original en negativa ni cancela automáticamente la suscripción. Índices únicos para idempotencia y referencia externa cuando exista.

### No crear en esta etapa

- `billing_subscriptions`, `billing_payments`, `billing_events`, `billing_consents`: duplicados.
- `billing_customers`: ya existe.
- `payment_methods`: posponer hasta elegir flujo de tokenización/gestión de método de pago; almacenar solo referencias tokenizadas.
- `invoices`, `credit_notes`, `tax_profiles`: decidir con el proveedor/asesor fiscal y el modelo documental; billing_customers ya contiene perfil fiscal inicial.
- `billing_ledger`, `exchange_rates`, `reconciliation`: fase posterior, cuando se definan datos de liquidación, extractos y criterio contable.
- `subscription_items` y `subscription_changes`: no necesarias para los tres planes simples actuales; añadir si aparecen add-ons, prorrateos o historial de cambios con impacto contractual.

Las migraciones deben ser aditivas, con constraints, índices, RLS y grants explícitos. Nunca modificar o borrar los registros financieros existentes en cascada.

## 6. Flujos usando las tablas actuales

### Checkout
1. API obtiene el workspace de la sesión y valida owner/admin.
2. Lee `billing_customers` y país de facturación.
3. Resuelve precio en `plan_prices` (mercado y moneda exactos).
4. Crea `checkout_sessions` con `quote_snapshot` e idempotencia.
5. Persiste las decisiones de consentimiento en `consent_records`, relacionadas al checkout y al documento exacto de `legal_documents`.
6. Crea sesión externa con el adaptador.
7. Actualiza referencias de proveedor en checkout.
8. Responde URL de checkout.
9. La página de retorno solo consulta estado; no activa acceso.

### Webhook
1. Endpoint por proveedor o endpoint común valida firma antes de confiar en el cuerpo.
2. Inserta evento en `payment_events` usando unique(provider, provider_event_id).
3. Evento duplicado devuelve respuesta idempotente sin repetir efectos.
4. Procesador relee evento y entidad actual.
5. Verifica cuenta, entorno, moneda, importe y referencia.
6. Actualiza `payment_transactions` y `subscriptions` en transacción.
7. Emite evento de dominio en `outbox_events`.
8. Marca evento procesado; errores registran attempts/last_error y permiten retry.

### Activación de derechos
La actualización de suscripción debe alimentar el mecanismo de periodos/capacidades ya existente (`workspace_usage_periods` y `billing_plans.capabilities`). No crear tabla paralela de entitlements sin auditoría del mecanismo actual.

### Cancelación
Reutilizar el endpoint y RPC de cancelación México existentes. Extender la lógica para llamar al adaptador externo y solo reflejar el resultado confirmado. Distinguir cancelación inmediata y al final del periodo. Mantener separados cancelación comercial, desistimiento/revocación y reembolso.

### Notificaciones
Publicar en `outbox_events`; reutilizar el dispatcher existente. No enviar emails directamente dentro de la transacción de pago.

## 7. Endpoints objetivo

Antes de crear una ruta, comprobar si existe una ruta equivalente y ampliarla.

| Endpoint | Responsabilidad |
|---|---|
| `GET /api/billing/catalog` | Mantener; devolver planes/precios aplicables al mercado |
| `POST /api/billing/checkout` | Crear checkout con precio servidor y consentimiento |
| `GET /api/billing/checkout/[id]` | Consultar estado autorizado |
| `GET /api/billing/subscription` | Consultar suscripción del workspace |
| `POST /api/billing/subscriptions/[id]/cancel` | Extender cancelación existente |
| `POST /api/billing/subscriptions/[id]/resume` | Reactivar si proveedor y estado lo permiten |
| `POST /api/billing/refunds` | Solicitud autorizada de reembolso |
| `POST /api/webhooks/stripe` | Validar y encolar eventos Stripe |
| `POST /api/webhooks/mercadopago/argentina` | Validar eventos MP AR |
| `POST /api/webhooks/mercadopago/mexico` | Validar eventos MP MX |

## 8. Precios y monedas

Mantener `plan_prices` como fuente única de precios. Usar códigos de mercado estables acordados en la aplicación (recomendación: `ES`, `AR`, `MX`) y moneda ISO 4217 EUR/ARS/MXN. Los códigos deben ser coherentes entre catálogo, checkout y adaptadores.

No copiar precios a constantes del frontend. No convertir automáticamente un precio USD a moneda local. Cargar importes locales solo después de aprobación comercial.

El cargo del cliente conserva su moneda local. La contabilidad de CYRANO SAS se expresa en EUR mediante un proceso posterior de liquidación/contabilidad; no confundir importe cobrado, conversión del proveedor, comisión, payout e importe contable.

## 9. Seguridad y controles

- Credenciales solo en variables de entorno de servidor/Vercel.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- MP AR: `MERCADOPAGO_AR_ACCESS_TOKEN` y secreto de webhook configurado según el mecanismo oficial.
- MP MX: `MERCADOPAGO_MX_ACCESS_TOKEN` y secreto de webhook configurado según el mecanismo oficial.
- Service role solo en servidor después de autenticar y autorizar workspace.
- Verificar firmas conforme a la documentación vigente de cada proveedor.
- Comprobar importe, moneda, external id, cuenta y entorno antes de actualizar estado.
- No confiar en parámetros del navegador ni URL de retorno.
- No guardar datos de tarjeta.
- RLS y grants de tablas financieras deben seguir server-only para mutaciones.
- No activar MP hasta verificar elegibilidad contractual de CYRANO SAS.

## 10. Plan de implementación y archivos

La lista siguiente es el plan objetivo; primero se inspecciona el árbol real para adaptar nombres y no crear duplicados.

### Paso 0 — inspección de código
- Revisar `src/app/api/billing/catalog/route.ts`.
- Revisar `src/app/w/[workspaceId]/facturacion/page.tsx`.
- Revisar `src/components/checkout-legal-consents.tsx`.
- Revisar endpoint/RPC de cancelación México y `mexico-subscription-controls.tsx`.
- Revisar `src/lib/supabase/admin.ts`, tipos Supabase y outbox dispatcher.
- Localizar `workspace_usage_periods` y el control de capacidades.
- Actualizar tipos DB generados tras migraciones.

### Paso 1 — migraciones y pricing
- Migración A: referencias checkout/provider.
- Migración B: mapeo provider customer.
- Añadir ES/EUR, AR/ARS, MX/MXN solo con importes aprobados.
- No borrar GLOBAL/USD hasta decidir su uso; ocultarlo del catálogo público de mercados si no es comercialmente válido.
- Tests de selección de precio, vigencia, moneda y mercado.

### Paso 2 — Orchestrator + Stripe sandbox
- Crear contratos, registry y errores tipados.
- Implementar Stripe Checkout/subscription y consultas/cancelación.
- Crear endpoint de webhook, verificar firma y procesar eventos idempotentemente.
- Usar payment_events/payment_transactions/subscriptions/outbox existentes.
- Integrar consent_records en el checkout real.
- Mantener cobros live deshabilitados.

### Paso 3 — cancelación y reembolsos
- Extender cancelación México sin romper la protección frente a proveedores externos.
- Crear migración C de payment_refunds.
- Implementar refund sandbox y autorización elevada.
- Añadir pruebas de reembolso total/parcial y fallo.

### Paso 4 — Mercado Pago
- Implementar adaptadores separados AR y MX con contrato común.
- Mantener `enabled=false` hasta aprobación documental de CYRANO SAS.
- Probar en sandbox y contract tests.
- No activar producción ni asumir cuentas locales.

### Paso 5 — fiscalidad/conciliación
- Seleccionar estrategia de factura y proveedor fiscal.
- Diseñar facturas/notas de crédito según asesoría fiscal de España, Argentina y México.
- Añadir conciliación/registro de liquidaciones y conversión a EUR cuando haya datos de payout reales.

## 11. Pruebas de aceptación

1. El precio se resuelve desde `plan_prices` por mercado/moneda/vigencia en servidor.
2. El navegador no puede alterar precio, moneda, proveedor o workspace.
3. Checkout y consentimiento quedan relacionados y con evidencia del documento/hash.
4. Repetir una petición con la misma idempotency key no duplica checkout ni pago.
5. Webhook con firma inválida se rechaza.
6. Webhook duplicado no duplica pago, periodo ni notificación.
7. Evento con importe/moneda/cuenta no coincidente no activa suscripción.
8. Solo evento confirmado válido actualiza la suscripción y derechos.
9. Cancelación externa pendiente no se muestra como completada.
10. Reembolso queda separado del estado de suscripción.
11. Usuarios de otro workspace no pueden leer ni modificar datos.
12. MP AR/MX no pueden operar en producción mientras no estén aprobados y habilitados.
13. Notificaciones se encolan mediante outbox y tienen deduplicación.
14. Las pruebas sandbox no crean cargos reales.

## 12. Decisiones pendientes que bloquean producción

- Importes comerciales finales por plan/país/periodicidad.
- Elegibilidad y contrato de Stripe para CYRANO SAS.
- Elegibilidad y liquidación MP Argentina/México para CYRANO SAS.
- Proveedor/estrategia de facturación fiscal.
- Tratamiento fiscal validado por asesoría en cada mercado.
- Prorrateo/cambios de plan y política de reintentos.
- Política de devolución y permisos administrativos.
- Variables y dominios de email transaccional.

**Regla final:** completar la fundación existente; no reconstruirla. Stripe sandbox es la primera integración. Mercado Pago se prepara bajo la misma interfaz y permanece deshabilitado hasta aprobación contractual. No fusionar ni desplegar cobros reales como parte de esta fase documental.
