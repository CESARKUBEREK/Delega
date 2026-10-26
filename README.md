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
    url := 'https://xgbmpziocflgsszzgyeb.supabase.co/functions/v1/mail-cron',
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
    url := 'https://xgbmpziocflgsszzgyeb.supabase.co/functions/v1/runs-cron',
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

## Tokko Broker y Xubio

- **Tokko Broker** (`tokko-connection`, `_shared/tokko.ts`, categoría Inmobiliaria): clave de API de la inmobiliaria (Mi empresa → Permisos), validada al guardar y cifrada en Vault.
  - Lectura libre:
    - `tokko_search` recorre la cartera (hasta 600 propiedades) y filtra por operación, tipo, zona o texto, precio, moneda y ambientes.
    - `tokko_property` devuelve la ficha completa.
    - `tokko_developments` devuelve los emprendimientos.
  - Con aprobación: `tokko_register_lead`, que registra la consulta en el CRM de Tokko (`POST /api/v1/webcontact/`) con la etiqueta «Orkesta» y las propiedades.
- **Xubio** (`xubio-connection`, `_shared/xubio.ts`, categoría Contabilidad): Client ID y Secret ID (Configuración → Integraciones → API de Xubio), en Vault como JSON.
  - Token OAuth2 `client_credentials` (1 hora), que se pide al usarlo.
  - **Solo lectura:** `xubio_list` (clientes, proveedores, productos, facturas de venta y de compra con rango de fechas) y `xubio_get`.
  - No se crean comprobantes: una factura es un documento fiscal (ARCA/AFIP) que no se deshace.
- **Plantillas:** «Responder consultas de propiedades» (al llegar un correo) y «Resumen semanal de facturación» (los lunes).
- **Sin probar con cuentas reales:** los formatos de respuesta se tomaron de la documentación pública y de integraciones existentes. La primera conexión real lo confirmará.

```bash
supabase functions deploy tokko-connection xubio-connection run-flow assistant
supabase functions deploy runs-cron telegram-webhook mail-cron --no-verify-jwt
```

## Revisión antes del despliegue (24 oct)

- **Bandeja y contabilidad, solo administradores:** la bandeja solo la ven owners y admins.
  - El agente solo usa `inbox_list`, `inbox_read`, `reply_email` y Xubio en ejecuciones lanzadas por un owner o admin activo.
  - Las automatizaciones «al llegar un correo» y de Telegram solo se lanzan si las creó un owner o admin.
  - Antes, un miembro podía leer correos a través del agente o de una automatización suya.
- **Tareas periódicas** (`mail-cron`, `runs-cron`): responden enseguida (202) y siguen en segundo plano con `EdgeRuntime.waitUntil`, como recomienda Supabase. Así no dependen del tiempo de espera de `pg_net`.
- **Ejecuciones colgadas:** `runs-cron` da por fallidas las ejecuciones «en marcha» de hace más de 24 h.
- **Migraciones:** las 11 se aplican de cero, en orden, sobre una base limpia, y pasan los 173 tests.

## Zona horaria y canales de aviso (6E-2)

- **Zona horaria del espacio** (`workspaces.timezone`, Configuración → Zona horaria del espacio): solo owners y admins, con `workspace_set_timezone`. Al cambiarla se recalculan las programadas. Si no se elige, se usa la de Google Calendar y, si no hay, Europe/Madrid. El agente la usa para fechas y agenda.
- **Mis avisos** (`user_channels`, Configuración → Mis avisos): cada persona elige por dónde le llegan sus avisos (`notify_me`): push, correo o Telegram. Por defecto, todos. El aviso siempre queda en la ejecución.
- **Vincular Telegram:**
  1. «Vincular mi Telegram» genera un código de 8 caracteres que caduca en 15 min. Solo se guarda su huella sha256.
  2. Se escribe `/vincular CÓDIGO` al bot del espacio en un chat privado, o se abre el enlace `t.me/<bot>?start=CÓDIGO`.
  3. `telegram-webhook` lo resuelve con `telegram_link_complete`. Ese mensaje no entra en la bandeja ni lanza flujos.
- **El asistente propone la programación:** `plan.trigger.schedule` (frecuencia, hora, día) rellena la programación al guardar el plan. Avisar al propio usuario es un paso `notify` sin conexión y sin aprobación.
- **Plantillas nuevas:** Control de vencimientos (lunes) y Cifras de la semana en una planilla (viernes).

```bash
supabase functions deploy run-flow assistant
supabase functions deploy telegram-webhook runs-cron mail-cron --no-verify-jwt
```

## Tu chat con Orkesta por Telegram (25 oct)

El chat privado que cada persona vincula (Configuración → Mis avisos) es también su chat con Orkesta. Sus mensajes no entran en la bandeja; cualquier otro chat sigue igual (bandeja y automatizaciones `telegram_message`). Código: `_shared/telegram-chat.ts`, `_shared/telegram-notice.ts`, `_shared/decide.ts`, `_shared/transcribe.ts`.

- **Peticiones:** texto o nota de voz (transcrita con la clave de OpenAI del espacio, máx. 150 s). Crea una ejecución con disparador `telegram_chat`, con los permisos de esa persona y los 5 archivos elegidos más recientes. Lleva como contexto los 3 últimos intercambios de la última hora (`/nuevo` lo corta: `user_channels.telegram_chat_since`). La respuesta (el resumen de `finish`) vuelve al chat; si tarda, sigue `runs-cron`. Máx. 30 peticiones por hora y persona.
- **Aprobaciones con botones:** cuando una ejecución espera aprobación, además del push se envía el detalle al chat de quien decide (quien la lanzó o, si no, los admins), si tiene Telegram vinculado y activado en Mis avisos. Cada botón lleva el id de la ejecución y una huella de la acción concreta (`ap|re:<run>:<sha256(call_id)[0..12]>`): un botón viejo nunca decide otra acción. Caducan a las 24 h. Solo cuenta si lo pulsa la persona dueña del chat privado. `update_range` (sobrescribir celdas) solo se aprueba en la app. La decisión usa la misma lógica que la app (`decideRun`) y queda en la ejecución como «Decisión tomada desde Telegram».
- **Comandos:** `/pendientes`, `/automatizaciones` (botones para lanzar, pausar o reactivar; solo quien la creó o un admin), `/resumen`, `/nuevo`, `/ayuda`.
- **Webhook:** ahora también recibe `callback_query`. `runs-cron` vuelve a registrar una vez los webhooks de los bots conectados antes (`config.webhook_v`), con el mismo secreto y sin perder mensajes. No hace falta volver a conectar el bot.
- Migración `20261025230000_telegram_chat.sql`, test `014_telegram_chat.test.sql` y `supabase/functions/_shared/telegram-chat.test.ts` (`deno test -A`).

## Editor visual de flujos (26 oct)

- **Dónde:** Automatizaciones → «Crear desde cero» (`/automatizaciones/nueva`) y «Editar pasos» en cada automatización (`/automatizaciones/[id]/editar`, solo autor o admin).
- **Forma:** una tarjeta «Cuándo empieza» y una lista de pasos en orden (sin ramas: el agente sigue el orden y entiende condiciones escritas). Cada paso: qué hace (`read`, `compare`, `transform`, `generate`, `condition`, `write`, `notify`), con qué aplicación (solo las conectadas y válidas para ese tipo, `KIND_CONNECTIONS`), título e instrucciones. Insertar con «+», subir, bajar, duplicar, borrar. En el móvil, el paso se edita en un panel inferior.
- **«Complétalo tú (IA)»:** `assistant` con `action: "step"` convierte una frase en un paso (`STEP_SCHEMA`, `sanitizeStep`); no guarda nada. Límite: 12 llamadas de IA por minuto y persona.
- **Archivos que usa:** hasta 5 de los elegidos en Drive; se guardan en `settings.file_ids` (los mismos que usa la activación).
- **Comprobaciones** (`planChecks`): integraciones sin conectar, planillas o documentos sin elegir, envíos por correo sin contactos autorizados, Telegram fuera del disparador de Telegram, programadas que no avisan ni guardan nada. Avisan, no bloquean.
- **Reglas** (`src/lib/plan-edit.ts`, `normalizePlan`): el servidor (`flow-editor-actions.ts`) vuelve a normalizar todo lo que llega del navegador: máximo 20 pasos, límites de texto, tipos y aplicaciones válidos, ids `s1…sn`, conexiones deducidas de los pasos, aprobación obligatoria en `write` y en `notify` a otros. La base de datos lo impone otra vez (trigger `flows_enforce_approval`, migración `20261026000000_flow_editor.sql`).
- Si se cambia el inicio de una automatización activa, se pausa para revisar su activación.
- **Tests:** `npm test` (reglas del editor) y pgTAP `015_flow_editor.test.sql`.

## WhatsApp por Twilio (26 oct)

WhatsApp entra como canal de clientes a través de **Twilio** (proveedor oficial). Ahora se usa su **entorno de pruebas** (número compartido +1 415 523 8886), sin Meta ni empresa. Con un número propio aprobado en Twilio funciona igual; más adelante, la conexión directa con Meta (Cloud API) podrá ser otro proveedor del mismo canal.

- **Conexión** (`whatsapp-connection`, owners y admins): Account SID, Auth Token y número remitente (vacío = entorno de pruebas). Se comprueban con la API de Twilio y se guardan en Vault. Integraciones muestra la dirección para Twilio: `…/functions/v1/whatsapp-webhook?c=<integración>`, que se pega en «Sandbox settings → When a message comes in» (POST).
- **Recepción** (`whatsapp-webhook`, sin `verify_jwt`): exige la firma `X-Twilio-Signature` (HMAC-SHA1 con el Auth Token sobre la URL pública y los parámetros ordenados) y que el `AccountSid` sea el conectado. Registra el mensaje en la bandeja (canal `whatsapp`, conversación = número del cliente) y lanza las automatizaciones activas con inicio `whatsapp_message` creadas por un owner o admin (máx. 3 por mensaje y 30 por hora). Responde TwiML vacío.
- **Respuesta:** `send_whatsapp` (a quien escribió) y `reply_whatsapp` (a una conversación de la bandeja), siempre con aprobación (app o botones de Telegram). Solo dentro de la **ventana de 24 h** desde el último mensaje del cliente: se comprueba al proponer y otra vez al aprobar. Máx. 1600 caracteres. También desde la Bandeja (`inbox-reply`).
- **Plantillas:** «Atender WhatsApp de clientes» y «Contactos de WhatsApp a HubSpot».
- **Pendiente:** plantillas de Meta para escribir fuera de las 24 h; adjuntos (ahora se anotan como «[archivo adjunto]»); alta de clientes con un clic cuando Orkesta sea proveedor tecnológico de Meta.
- Migración `20261026100000_whatsapp.sql`, test pgTAP `016_whatsapp.test.sql`, `supabase/functions/_shared/whatsapp.test.ts` (firma de Twilio contra una implementación de referencia).

## Despliegue automático de las funciones (desde el 25 oct)

- **Proyecto:** Supabase **DOrkesta** (`xgbmpziocflgsszzgyeb`).
- **GitHub Actions** (`.github/workflows/deploy-functions.yml`): despliega las 19 Edge Functions cada vez que cambian en `main`, o a mano desde Actions → «Desplegar funciones de Supabase» → Run workflow. Usa `--use-api`, así que no necesita Docker.
- **Requisito único:** el secreto del repositorio `SUPABASE_ACCESS_TOKEN`, un token personal de https://supabase.com/dashboard/account/tokens.
- **Secreto de las tareas periódicas:** `mail-cron` y `runs-cron` leen el secreto de Vault (`orkesta_mail_cron_secret`) con la RPC `cron_secret` (migración 13, solo `service_role`). La variable `MAIL_CRON_SECRET` ya no es necesaria; si existe, tiene prioridad.
