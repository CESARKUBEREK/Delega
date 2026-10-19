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
| `/w/[id]/integraciones` | Conectar la clave de OpenAI del espacio (BYOK) y elegir modelo |
| `/w/[id]/historial` | Conversaciones y consumo de tokens del mes |
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

En esta fase nada se ejecuta: el plan se revisa y se guarda como borrador.
