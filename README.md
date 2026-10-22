# Delega

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

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL`. Son valores públicos; ninguna variable secreta hace falta en Vercel en esta fase.

## Base de datos

Las migraciones viven en `supabase/migrations/` y se versionan por marca de tiempo (`YYYYMMDDHHMMSS_nombre.sql`). Una migración aplicada no se edita nunca: cada corrección es una migración nueva.

| Migración | Contenido |
|---|---|
| `20261019150533_core_auth_workspaces.sql` | Perfiles, espacios (personal u organización), membresías con rol, invitaciones, auditoría, RLS y trigger de alta |
| `20261019210000_ai_assistant.sql` | Conexiones de IA (clave en Vault), conversaciones, mensajes, flujos y consumo |
| `20261020150000_docs_inbox.sql` | Gmail y Telegram (integraciones con configuración), contactos autorizados por correo, bandeja (conversaciones clasificadas y mensajes), disparadores y ajustes de flujos |
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

## Google Docs, Gmail, Telegram y bandeja

- **Docs:** con el mismo permiso `drive.file`, el selector admite documentos. El agente puede `read_document`, `append_to_document` y `create_document` (los documentos creados se registran como archivos del espacio). Escrituras siempre con aprobación.
- **Gmail:** conexión aparte (provider `gmail`) con `gmail.readonly` y `gmail.send` (alcances restringidos de Google: mientras la app esté en pruebas, el acceso caduca cada 7 días). `inbox-sync` importa los últimos 30 días y después usa el historial de Gmail, por tandas. Delega no borra ni archiva nada del buzón.
- **Telegram:** bot propio creado con @BotFather. `telegram-connection` valida el token con `getMe`, lo guarda en Vault y registra el webhook `…/telegram-webhook?c=<integración>` con un `secret_token` aleatorio. `telegram-webhook` se despliega **sin** `verify_jwt` y comprueba `X-Telegram-Bot-Api-Secret-Token`. Los mensajes nuevos lanzan los flujos activos con disparador `telegram_message` (máx. 30 por hora y espacio).
- **Bandeja:** `/w/[id]/bandeja`, correo y Telegram juntos. `inbox-classify` propone categoría (lista configurable), cliente, proyecto, urgencia, si necesita respuesta y un resumen; las correcciones manuales no las pisa la IA. `inbox-reply` redacta con IA (`draft`) y envía lo que la persona revisa (`send`, en el mismo hilo de Gmail o el mismo chat). Solo admins y owners. Conservación configurable en días.
- **Envíos del agente:** `send_email` solo a contactos autorizados; `send_telegram` solo a quien escribió al bot. Siempre con aprobación.

```bash
supabase functions deploy inbox-sync inbox-classify inbox-reply telegram-connection
supabase functions deploy telegram-webhook --no-verify-jwt
```
