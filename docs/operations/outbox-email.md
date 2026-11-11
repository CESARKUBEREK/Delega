# Entrega de notificaciones del outbox

El endpoint `GET /api/internal/outbox/dispatch` procesa hasta 25 eventos pendientes. Vercel Cron lo invoca cada cinco minutos en despliegues de producción. La ruta valida `Authorization: Bearer <CRON_SECRET>` (nombre estándar de Vercel) y usa exclusivamente credenciales de servidor. Las ejecuciones Cron no se disparan en Preview.

## Variables de entorno

Configurar en Vercel (Production y Preview según corresponda):

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto DOrkesta.
- `SUPABASE_SERVICE_ROLE_KEY`: clave service-role, solo servidor.
- `CRON_SECRET`: secreto aleatorio largo compartido con el cron.
- `RESEND_API_KEY`: clave de API de Resend.
- `EMAIL_FROM`: remitente verificado en Resend, por ejemplo `MarchaSolo <notificaciones@marchasolo.com>`.
- `NEXT_PUBLIC_SITE_URL`: URL pública de MarchaSolo para enlaces de facturación.

No habilitar la entrega en producción hasta verificar el dominio remitente en Resend y cargar todos los secretos. La ausencia de credenciales deja los eventos en cola y el endpoint devuelve 503; no marca eventos como enviados.

## Garantías y límites

- Reclamación atómica con `FOR UPDATE SKIP LOCKED`.
- Reintentos con espera exponencial, hasta ocho intentos; recuperación de bloqueos abandonados tras quince minutos.
- Clave de idempotencia por ID de evento en la llamada al proveedor.
- Los avisos legales se envían a `legal@marchasolo.com` y el acuse al email declarado por la persona.
- Los avisos mexicanos se envían cinco días antes de la renovación, según el evento ya programado por la base de datos.
- El estado `published` significa que el proveedor aceptó el mensaje, no que el destinatario lo haya leído ni que la entrega final esté garantizada.
