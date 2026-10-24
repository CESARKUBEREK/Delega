# Orkesta (antes Delega)

Plataforma de automatización con IA, en español, para profesionales y pequeños despachos. El usuario describe una tarea, la IA propone un flujo y el usuario lo aprueba antes de ejecutarlo.

**Stack:** Supabase (Auth, Postgres con RLS, Edge Functions, Vault) y frontend en Next.js 16 sobre Vercel.

## Frontend

```bash
cp .env.example .env.local   # rellena la clave publicable
npm install
npm run dev                  # http://localhost:3000
```

- **Sesión:** se guarda en cookies con `@supabase/ssr`, no en `localStorage`. La refresca `src/proxy.ts`, que también protege `/w/*`.
- **Identidad en el servidor:** se valida siempre con `getClaims()`. Nunca se confía en `getSession()` para autorizar.
- **Clave en el navegador:** el frontend solo usa la clave publicable. Las claves secretas y las de IA no pasan nunca por aquí.
- **Cabeceras de seguridad:** CSP, HSTS, `frame-ancestors 'none'` y otras, definidas en `next.config.ts`.
- **Tipografía:** Archivo, autoalojada mediante `@fontsource-variable`, sin peticiones a Google Fonts.

| Ruta | Para qué |
|---|---|
| `/login`, `/signup` | Entrar o crear cuenta, con correo o con Google |
| `/forgot-password`, `/reset-password` | Recuperar el acceso |
| `/auth/callback` | Retorno de OAuth (PKCE) |
| `/auth/confirm` | Enlaces de los correos de Supabase (`token_hash`) |
| `/w` | Tus espacios y crear una organización |
| `/w/[id]` | Panel del espacio: estado de la IA, borradores y conversaciones recientes |
| `/w/[id]/asistente` | Chat que convierte una petición en un plan de flujo revisable (`?c=` abre una conversación) |
| `/w/[id]/automatizaciones` | Planes guardados como borrador y su detalle |
| `/w/[id]/integraciones` | Clave de OpenAI (BYOK) y modelo; cuenta de Google y planillas elegidas |
| `/w/[id]/historial` | Ejecuciones, conversaciones y consumo de tokens del mes |
| `/w/[id]/ejecuciones/[run]` | Avance de una ejecución, aprobación de escrituras y bitácora |
| `/integraciones/google/callback` | Vuelta del consentimiento de Google (el canje lo hace la Edge Function) |
| `/w/[id]/configuracion` | Miembros, invitaciones, nombre, salir o borrar |
| `/invite#token` | Aceptar una invitación. El token va en el fragmento para que no llegue al servidor |

### Configuración pendiente en Supabase (panel → Authentication)

1. **URL Configuration**
   - Site URL: la URL de producción.
   - Redirect URLs: `http://localhost:3000/**` y la URL de producción con `/**`. No añadas comodines abiertos de `*.vercel.app`.
2. **Email Templates:** cambia el enlace de cada plantilla para que use `token_hash` (así funciona aunque se abra en otro dispositivo).
   - *Confirm signup:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/w`
   - *Reset password:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
   - *Change email:* `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change`
3. **Providers → Email:**
   - Confirm email: activado.
   - Longitud mínima de contraseña: 10.
   - Protección contra contraseñas filtradas: activada, si tu plan la incluye.
4. **Antes de producción:**
   - SMTP propio, porque el de serie tiene límites muy bajos.
   - Proveedor Azure (Microsoft).
   - CAPTCHA (Turnstile) en registro, acceso y recuperación.

### Variables en Vercel

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` y `VAPID_PUBLIC_KEY` (la clave pública de los avisos, ver «App móvil»). Son valores públicos; ninguna variable secreta hace falta en Vercel.

## Base de datos

Las migraciones viven en `supabase/migrations/` y se versionan por marca de tiempo (`YYYYMMDDHHMMSS_nombre.sql`). Una migración aplicada no se edita nunca: cada corrección es una migración nueva.

| Migración | Contenido |
|---|---|
| `20261019150533_core_auth_workspaces.sql` | Perfiles, espacios (personal u organización), membresías con rol, invitaciones, auditoría, RLS y trigger de alta |
| `20261019210000_ai_assistant.sql` | Conexiones de IA (clave en Vault), conversaciones, mensajes, flujos y consumo |
| `20261020150000_docs_inbox.sql` | Gmail y Telegram (integraciones con configuración), contactos autorizados por correo, bandeja (conversaciones clasificadas y mensajes), disparadores y ajustes de flujos |
| `20261023090000_calendar_hubspot.sql` | Proveedores `calendar` (OAuth de Google) y `hubspot` (clave en Vault) |
| `20261020090000_sheets_runs.sql` | Integración con Google (refresh token en Vault), planillas elegidas, ejecuciones y bitácora; índices pendientes |

### Modelo de seguridad

- **Sin acceso anónimo.** `anon` no tiene acceso a ninguna tabla de este módulo.
- **Fuente de verdad de los permisos.** Las membresías activas deciden todo, y la RLS las comprueba con `private.is_member()` y `private.has_role()`.
- **Roles por espacio.** Hay tres: `owner`, `admin` y `member`. Solo un `owner` gestiona el rol `owner`, y una organización nunca se queda sin `owner` activo.
- **Espacio personal.** Se crea al registrarse, con un único miembro, y no admite invitaciones.
- **Invitaciones.**
  - El token aleatorio es de 256 bits, se guarda como hash SHA-256 y caduca a los 7 días.
  - Es de un solo uso.
  - Solo la acepta quien inicie sesión con el mismo correo invitado, ya verificado.
- **Auditoría.** `audit_log` es *append-only*: la escriben solo las funciones del servidor y la leen admins y owners.

- **Claves de IA (BYOK).** La clave de OpenAI de cada espacio se cifra en Supabase Vault. La tabla `ai_connections` solo guarda una pista (`…abcd`); la columna `vault_secret_id` no se concede a `authenticated`. Solo `service_role` (las Edge Functions) puede guardar, descifrar o borrar la clave, y al borrar la conexión o el espacio se borra también el secreto.
- **Asistente.** Los mensajes y el consumo los escriben solo las Edge Functions. Cada persona ve sus conversaciones; admins y owners ven las de todo el espacio.
- **Flujos.** Cualquier miembro ve y crea borradores; solo el autor o un admin los edita o borra. Un flujo nuevo nace siempre como `draft`.

### Probar en local

Requiere la [CLI de Supabase](https://supabase.com/docs/guides/local-development) y Docker.

```bash
supabase start          # levanta Postgres, Auth, etc. en local
supabase db reset       # aplica las migraciones desde cero
supabase test db        # ejecuta supabase/tests/database/*.test.sql (pgTAP)
```

### Aplicar en el proyecto remoto

Solo con autorización explícita y después de que `supabase test db` pase en verde.

```bash
supabase link --project-ref <ref-del-proyecto>
supabase db push
```

Después de aplicar, revisa los *advisors* de seguridad y rendimiento en el panel de Supabase.

## Edge Functions

Viven en `supabase/functions/` (Deno). Se despliegan con `verify_jwt` activo y las llaman las Server Actions de Next.js con el JWT del usuario (`src/lib/edge-functions.ts`); el navegador no las llama directamente.

| Función | Qué hace |
|---|---|
| `ai-connection` | Solo owners y admins. `save` valida la clave con `GET /v1/models` y la guarda en Vault; `set_model` cambia el modelo; `delete` borra la conexión y el secreto |
| `assistant` | Recibe un mensaje, recupera la clave del espacio, llama a la Responses API de OpenAI con salida estructurada (`json_schema` estricto, `store: false`) y guarda la respuesta, el plan y los tokens usados. Límite: 8 mensajes por minuto y persona |

```bash
supabase functions deploy ai-connection
supabase functions deploy assistant
```

### Formato de un flujo (versión 1)

El asistente devuelve `{ reply, plan }`, donde `plan` es `null` o un objeto con este formato, que se guarda tal cual en `messages.plan` y en `flows.definition`. El esquema está en `supabase/functions/assistant/plan-schema.ts` y su lector seguro en `src/lib/plan.ts`.

```json
{
  "version": 1,
  "name": "Informe mensual de ventas",
  "summary": "Compara las ventas del mes con las del anterior y envía un resumen.",
  "trigger": { "type": "schedule", "description": "el día 1 de cada mes" },
  "connections": [{ "kind": "spreadsheet", "purpose": "Leer la planilla de ventas" }],
  "steps": [
    { "id": "s1", "kind": "read", "title": "Leer ventas", "description": "…", "connection": "spreadsheet", "requires_approval": false },
    { "id": "s2", "kind": "notify", "title": "Enviar resumen", "description": "…", "connection": "email", "requires_approval": true }
  ],
  "open_questions": ["¿A quién se envía el resumen?"]
}
```

- `kind` de un paso: `read`, `transform`, `compare`, `generate`, `write`, `notify` o `condition`.
- `connection`: `spreadsheet`, `email`, `calendar`, `database`, `documents` o `none`.
- Los pasos `write` y `notify` llevan siempre `requires_approval: true`, aunque el modelo diga lo contrario.

## Planillas y ejecución

- **Acceso a Google:** permiso `drive.file` (no sensible). Delega solo abre las planillas que un administrador elige con el selector de Google. El refresh token se guarda cifrado en Vault; al navegador solo llega un token de una hora para abrir el selector.
- **Ejecución:** la Edge Function `run-flow` sigue el plan con un agente (Responses API, `store: false`) y cinco herramientas: `list_sheets`, `read_range`, `append_rows`, `update_range` y `finish`. Leer no requiere permiso; **cada escritura se pausa** (`awaiting_approval`) y el usuario ve las filas exactas antes de aprobar. Se escribe en modo `RAW`, así que nada se interpreta como fórmula.
- **Por tramos:** cada petición avanza como mucho 90 s; el panel pide `continue` hasta terminar. Un *lease* en `flow_runs` impide avanzar la misma ejecución dos veces a la vez. Límites: 40 acciones, 3.000 celdas por lectura y 5.000 por escritura.
- **Configuración:** secretos `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en las Edge Functions; en Vercel, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` (restringida a la Picker API y al dominio) y `NEXT_PUBLIC_GOOGLE_APP_ID` (número del proyecto). URI de redirección: `https://delega-five.vercel.app/integraciones/google/callback`.

```bash
supabase functions deploy google-connection
supabase functions deploy run-flow
```

## Google Drive, Calendar y HubSpot

- **Drive:** mismo permiso `drive.file`. El selector admite cualquier archivo y carpetas. El agente lee PDF, Word, Excel y PowerPoint convirtiendo una copia temporal a formato de Google (se borra al terminar), lista las carpetas elegidas (`list_folder`, solo lo que Drive deja ver con `drive.file`), lee archivos de esas carpetas comprobando que pertenecen a ellas y guarda archivos nuevos (`save_file`: documento, .txt o .csv) con aprobación.
- **Calendar:** conexión aparte (provider `calendar`) con `calendar.events` + `calendar.calendarlist.readonly` (sensibles, no restringidos). `list_events` lee el calendario principal (máx. 60 días); `create_event` y `update_event` requieren aprobación; los invitados solo pueden ser contactos autorizados.
- **HubSpot:** clave de servicio (Desarrollo → Claves → Claves de servicio) o token de app privada, validado con `account-info` y guardado en Vault (`hubspot-connection`). Lecturas: `crm_search`, `crm_get`, `crm_pipelines`. Con aprobación: `crm_create`, `crm_update` (incluye mover etapa con `dealstage`), `crm_note`, `crm_task`.

```bash
supabase functions deploy hubspot-connection google-connection run-flow assistant
supabase functions deploy telegram-webhook --no-verify-jwt
```

## Google Docs, Gmail, Telegram y bandeja

- **Docs:** con el mismo permiso `drive.file`, el selector admite documentos. El agente puede `read_document`, `append_to_document` y `create_document` (los documentos creados se registran como archivos del espacio). Escrituras siempre con aprobación.
- **Gmail:** retirado como integración OAuth en la migración 8 (sus permisos son restringidos y exigen una auditoría de Google). Gmail y Google Workspace se conectan ahora como correo IMAP/SMTP con una contraseña de aplicación.
- **Telegram:** bot propio creado con @BotFather. `telegram-connection` valida el token con `getMe`, lo guarda en Vault y registra el webhook `…/telegram-webhook?c=<integración>` con un `secret_token` aleatorio. `telegram-webhook` se despliega **sin** `verify_jwt` y comprueba `X-Telegram-Bot-Api-Secret-Token`. Los mensajes nuevos lanzan los flujos activos con disparador `telegram_message` (máx. 30 por hora y espacio).
- **Bandeja:** `/w/[id]/bandeja`, correo y Telegram juntos. `inbox-classify` propone categoría (lista configurable), cliente, proyecto, urgencia, si necesita respuesta y un resumen; las correcciones manuales no las pisa la IA. `inbox-reply` redacta con IA (`draft`) y envía lo que la persona revisa (`send`, en el mismo hilo de correo o el mismo chat). Solo admins y owners. Conservación configurable en días.
- **Envíos del agente:** `send_email` solo a contactos autorizados; `send_telegram` solo a quien escribió al bot. Siempre con aprobación.

```bash
supabase functions deploy inbox-sync inbox-classify inbox-reply telegram-connection
supabase functions deploy telegram-webhook --no-verify-jwt
```

## App móvil (PWA), chat que ejecuta y dictado

- **App instalable:** `src/app/manifest.ts` (abre en `/abrir`, que lleva al chat del último espacio usado; lo recuerda la cookie `orkesta_ws` que pone el proxy), iconos en `public/icons/` y `src/app/apple-icon.png`. El service worker (`public/sw.js`) solo guarda `/offline` y los iconos: nunca páginas ni datos de clientes. En el móvil, barra inferior Chat · Aprobaciones · Bandeja · Más.
- **«Ejecutar ahora»:** los planes con disparador manual se ejecutan desde el chat sin guardarlos (`run-flow`, acción `start_from_message`; el plan se lee del mensaje con la RLS del usuario y la petición original acompaña a la ejecución). `flow_runs.source_message_id` enlaza la ejecución con el mensaje y el chat muestra su avance, las aprobaciones y el resultado. Al lanzar o aprobar, `run-flow` avanza el primer tramo también en segundo plano (`EdgeRuntime.waitUntil`), para que siga aunque se cierre la app.
- **Aprobaciones:** `/w/[id]/aprobaciones` reúne todo lo pendiente (RLS: las propias o, para admins, las del espacio) y sigue avanzando las ejecuciones en curso. Nunca se aprueba por voz ni desde el aviso.
- **Avisos (Web Push):** `push_subscriptions` + función `push_subscribe` (cada usuario ve y borra sus dispositivos; las claves solo las lee `service_role`). El agente avisa al pedir aprobación (`_shared/push.ts`: VAPID y cifrado `aes128gcm` con WebCrypto, sin dependencias) a quien lanzó la ejecución o, si no hay nadie, a los administradores. El texto del aviso no incluye datos de clientes. Solo se envía a los servicios de push de los navegadores (Google, Mozilla, Apple, Microsoft). En iPhone hace falta iOS 16.4+ y la app instalada. La función `push` envía un aviso de prueba.
- **Dictado:** botón de micrófono en el chat (hasta 2 minutos) → `/w/[id]/voz` (Route Handler) → `voice-transcribe`, que transcribe con la clave de OpenAI del espacio (`gpt-transcribe`, o `gpt-4o-mini-transcribe` si la cuenta no tiene acceso). El audio no se guarda; el texto aparece en el cuadro para revisarlo antes de enviarlo. Consumo en `usage_events` (`kind = 'transcription'`, `audio_seconds`).
- **Respuesta leída:** con la voz del propio dispositivo (gratis, sin servidor). No se usa la voz de OpenAI: sus modelos de `/v1/audio/speech` se retiran el 6 de enero de 2027.

Claves VAPID (una vez; la privada no sale de Supabase):

```bash
node -e "const c=require('crypto').createECDH('prime256v1');c.generateKeys();console.log('VAPID_PUBLIC_KEY='+c.getPublicKey().toString('base64url'));console.log('VAPID_PRIVATE_KEY='+c.getPrivateKey().toString('base64url'))"
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu-correo@ejemplo.com
# y VAPID_PUBLIC_KEY (la misma pública) en las variables de Vercel
supabase functions deploy run-flow assistant voice-transcribe push
supabase functions deploy telegram-webhook --no-verify-jwt
```

## Correo IMAP/SMTP

- **Conexión** (`imap-connection`, tarjeta «Correo IMAP/SMTP» en Comunicaciones): dirección, contraseña (mejor una contraseña de aplicación) y servidores, con autocompletado para los proveedores habituales. Antes de guardar se comprueban IMAP (993, TLS) y SMTP (465, TLS directo). Supabase bloquea los puertos 25 y 587, así que los proveedores que solo admiten el 587 no sirven. Usuario y contraseña van en Vault como JSON; en `config` solo hay datos no secretos (servidores, carpeta de enviados, `uid_validity` y `last_uid`). Un buzón IMAP por espacio.
- **Seguridad de red:** el servidor lo escribe el usuario, así que se resuelve su nombre y se rechazan direcciones internas (localhost, redes privadas, Supabase). La conexión va a la IP comprobada, con el nombre original para validar el certificado.
- **Lectura** (`_shared/imap.ts`, librería `imapflow`): bandeja de entrada por UID. La primera vez, los últimos 30 días; después, solo lo nuevo. Si cambia `UIDVALIDITY`, vuelve a empezar. Solo se descarga la parte de texto (los adjuntos quedan como nombre) y como mucho 100 correos por llamada, para no pasar de los 2 s de CPU. No marca nada como leído ni mueve nada. El hilo se agrupa por el primer `Message-ID` de `References`/`In-Reply-To`, y los identificadores llevan el prefijo `imap:`.
- **Envío** (`nodemailer`): las respuestas de la bandeja (`inbox-reply`) y el `send_email` del agente salen por SMTP con `In-Reply-To`/`References`, y se guarda una copia en la carpeta de enviados (`APPEND`). Siempre con aprobación.
- **«Traer correo»** (`inbox-sync`) lee el buzón IMAP del espacio.
- **Lectura automática** (`mail-cron`, sin `verify_jwt`, cabecera `x-orkesta-cron`): recorre las cuentas de correo activas (`mail_integrations_due`), empezando por las que llevan más tiempo sin leerse.

```bash
supabase functions deploy imap-connection inbox-sync inbox-reply inbox-classify run-flow assistant
supabase functions deploy telegram-webhook mail-cron --no-verify-jwt
supabase secrets set MAIL_CRON_SECRET=$(openssl rand -hex 32)
```

Programar la lectura cada 5 minutos (extensiones `pg_cron` y `pg_net`; el secreto, el mismo que `MAIL_CRON_SECRET`, guardado en Vault):

```sql
select vault.create_secret('<MAIL_CRON_SECRET>', 'orkesta_mail_cron_secret');
select cron.schedule('orkesta-correo', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://owefcumdoqvtmhaksxln.supabase.co/functions/v1/mail-cron',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-orkesta-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orkesta_mail_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000)
$$);
```

Pruebas locales: `MAIL_TEST_INSECURE=1` (más `MAIL_TEST_IMAP_PORT` y `MAIL_TEST_SMTP_PORT`) admite `localhost` y certificados propios. Nunca se define en producción.

## Varias IAs: OpenAI, Anthropic y DeepSeek

- **Conexiones** (`ai-connection`, una tarjeta por proveedor en Integraciones → LLMs): clave propia de cada proveedor (BYOK), validada listando sus modelos y cifrada en Vault. Un espacio puede tener las tres. Una es la **principal** (`ai_connections.is_default`): la primera que se conecta, y se cambia con «Usar como IA principal». Si se borra, pasa a serlo otra.
- **Quién usa cuál:** el asistente, la clasificación y los borradores de la bandeja usan la principal. Cada automatización puede fijar su propio modelo (`flows.settings.model`, en la página de la automatización); si su proveedor deja de estar conectado, se usa la principal. Las ejecuciones desde el chat usan la principal. El dictado usa siempre OpenAI.
- **Capa común** (`_shared/llm.ts`): la conversación va en un formato neutro y cada adaptador la traduce:
  - **OpenAI:** Responses API, con `json_schema` estricto y `store: false`.
  - **Anthropic:** Messages API, con `output_config.format` para el JSON y herramientas con `tool_choice` sin llamadas en paralelo.
  - **DeepSeek:** Chat Completions en formato OpenAI. Usa `response_format: json_object` con el esquema en las instrucciones, y sin modo de razonamiento.

  Lo que devuelve cada proveedor se guarda en `native` para reenviarlo tal cual en la siguiente vuelta. Las ejecuciones antiguas (items de la Responses API) se convierten al vuelo. El agente atiende una acción por respuesta; si llegan más, las demás se contestan sin ejecutarse.
- **Modelos:**
  - OpenAI: `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6-luna`.
  - Anthropic: `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`.
  - DeepSeek: `deepseek-flash`, `deepseek-v4-pro`.

  Deben coincidir en `_shared/llm.ts` y `src/lib/plan.ts`.

## Excel en Google Drive

- Los archivos `.xlsx` elegidos en Drive se tratan como planillas (`_shared/excel.ts`, con ExcelJS): `list_sheets` y `read_range` sin aprobación; `append_rows` y `update_range`, con aprobación. Se descarga el archivo, se modifica y se sube como nueva versión del mismo archivo; Drive conserva la anterior.
- **Límites:**
  - Hasta 5 MB.
  - Los `.xls` antiguos se pueden leer, pero no escribir.
  - En los libros con gráficos, tablas dinámicas, segmentaciones o vínculos externos no se escribe (ExcelJS no los conserva); para escribir en ellos hay que pasarlos a Google Sheets.
- Los textos se escriben tal cual (aunque empiecen por «=», no son fórmulas). Las fórmulas y el formato que ya había se conservan.

```bash
supabase functions deploy ai-connection assistant run-flow inbox-classify inbox-reply inbox-sync imap-connection google-connection voice-transcribe push
supabase functions deploy telegram-webhook mail-cron --no-verify-jwt
```

## Al llegar un correo, plantillas y ejecuciones en segundo plano

- **Disparador «al llegar un correo»** (`email_message`, `_shared/triggers.ts`): cuando `mail-cron` o «Traer correo» leen correos nuevos, cada uno puede lanzar las automatizaciones activas con ese disparador.
  - Solo cuentan los correos recibidos en las últimas 48 h, nunca el histórico de la primera lectura.
  - **Filtros sin IA** (`flows.settings.email_filter`, en la página de la automatización): remitente, asunto y asunto o texto. Cada casilla no vacía tiene que cumplirse (basta una de sus palabras), sin distinguir mayúsculas ni acentos. Por defecto se ignoran los remitentes automáticos (no-reply, boletines, avisos).
  - Máximo 3 automatizaciones por correo y 30 ejecuciones por hora y espacio.
  - El agente recibe el correo como dato y puede contestar al «remitente» en el mismo hilo (`In-Reply-To`/`References`), siempre con aprobación.
- **Plantillas** (`src/lib/templates.ts`, página Automatizaciones → «Empezar con una plantilla»): ocho planes listos para usar (consultas por correo, pedidos a planilla, contactos al CRM, proponer cita, incidencias por Telegram, preparar reunión, negocios parados, informe semanal). Crean un borrador; se eligen los archivos, se ajustan los filtros y se activa.
- **`runs-cron`** (sin `verify_jwt`, mismo secreto `MAIL_CRON_SECRET`): cada minuto avanza hasta 3 ejecuciones en marcha que nadie está mirando (lanzadas por correo o Telegram, o que se quedaron a medias), de las últimas 24 h, con tramos de 50 s. El lease impide avanzar dos veces la misma.

```bash
supabase functions deploy run-flow assistant inbox-sync
supabase functions deploy telegram-webhook mail-cron runs-cron --no-verify-jwt
```

```sql
select cron.schedule('orkesta-ejecuciones', '* * * * *', $$
  select net.http_post(
    url := 'https://owefcumdoqvtmhaksxln.supabase.co/functions/v1/runs-cron',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-orkesta-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'orkesta_mail_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000)
$$);
```


## Ejecuciones programadas y avisos a uno mismo

- **Programación** (`flows.settings.schedule`, panel «Programación» de la automatización): cada día, días laborables, un día de la semana o un día del mes (1-28 o el último), a una hora. Hora local del espacio (la de Google Calendar o Europe/Madrid), también en los cambios de hora.
  - `flows.next_run_at` la calcula un trigger (`private.flow_next_run`); el navegador no puede fijarla.
  - `runs-cron` llama cada minuto a `flows_due()`, que toma las que tocan con `for update skip locked` y avanza su próxima ejecución en la misma operación.
  - Las perdidas hace más de 6 h no se lanzan. Máximo 20 programadas por espacio en 24 h. Tras 3 fallos seguidos, la automatización se pausa y se avisa a su creador.
- **Avisarme** (`notify_me`, `_shared/notify.ts`): el agente avisa a quien lanzó o creó la ejecución **sin aprobación**. El destinatario no es un parámetro: la IA no puede elegir otro.
  - Push con el nombre de la automatización, sin datos de clientes; al tocarlo se abre la ejecución con el texto.
  - Correo con el texto completo a la dirección de su cuenta, por el SMTP del espacio (no se guarda en la bandeja).
  - Siempre queda en la bitácora de la ejecución. Máximo 3 por ejecución y 30 al día por persona.
- **Bandeja para el agente** (`_shared/inbox-read.ts`): `inbox_list` y `inbox_read` sin aprobación; `reply_email` responde en el mismo hilo con aprobación.
- **Plantillas programadas:** resumen de la mañana, correos sin responder, agenda de mañana e informe semanal del CRM; «Negocios parados» e «Informe de la semana» pasan a ser programadas.

Despliegue: la migración `20261025090000_schedules.sql` y `supabase functions deploy run-flow assistant` + `supabase functions deploy runs-cron --no-verify-jwt` (el `pg_cron` de `runs-cron` ya corre cada minuto).
