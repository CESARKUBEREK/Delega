# Verificación de MarchaSolo en Google

Qué hace falta para que cualquier usuario pueda conectar Google Drive y Google
Calendar sin estar en la lista de usuarios de prueba y sin el aviso «Google no
ha verificado esta app».

El correo no pasa por Google Cloud: se conecta por IMAP con una contraseña de
aplicación, así que no forma parte de esta verificación.

## Permisos que pide MarchaSolo

| Permiso | Para qué | Tipo en Google |
|---|---|---|
| `openid`, `email` | Saber con qué cuenta de Google se conectó el usuario | Básico |
| `https://www.googleapis.com/auth/drive.file` | Leer y escribir solo los archivos y carpetas que el usuario elige en el selector de Google | No sensible |
| `https://www.googleapis.com/auth/calendar.events` | Consultar la agenda y crear o cambiar eventos, siempre con la aprobación del usuario | Sensible |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | Listar los calendarios del usuario para elegir en cuál trabajar | Sensible |

Como hay permisos sensibles (Calendar), Google pide **verificar la marca y
los permisos sensibles**. No hay permisos restringidos (como Gmail completo),
así que **no** hace falta la auditoría de seguridad de terceros.

## Antes de enviar

1. **Datos del responsable** (ya en `src/lib/legal.ts`): Cyrano SAS, Francia,
   legal@marchasolo.com. Ese buzón tiene que existir y recibir correo:
   Google escribe ahí durante la verificación.
2. **Dominio propio verificado.** La web, la política de privacidad y los
   términos tienen que estar en un dominio que controles (no
   `*.vercel.app`). Verifícalo en
   [Google Search Console](https://search.google.com/search-console) con la
   misma cuenta de Google que administra el proyecto de Google Cloud.
3. **Páginas públicas en ese dominio:**
   - Página de inicio: `https://TU-DOMINIO/para-que-sirve`
   - Política de privacidad: `https://TU-DOMINIO/privacidad`
   - Términos de uso: `https://TU-DOMINIO/terminos`
4. **URL de vuelta de OAuth** con el dominio nuevo:
   `https://TU-DOMINIO/integraciones/google/callback` (en el cliente OAuth de
   Google Cloud y en el secreto `DELEGA_SITE_URL` de las Edge Functions de Supabase,
   que es de donde sale esa dirección).

## En Google Cloud Console

**Google Auth Platform → Branding**

- Nombre de la app: `MarchaSolo`
- Logotipo: el icono (cuadrado turquesa con la flecha), 120 × 120 px, PNG.
  Sirve `public/icons/icon-512.png` reducido.
- Correo de asistencia al usuario: el de `src/lib/legal.ts`.
- Página principal, política de privacidad y términos: las tres URL de arriba.
- Dominios autorizados: tu dominio.
- Correo de contacto del desarrollador: el tuyo.

**Google Auth Platform → Data Access**

Añade los cuatro permisos de la tabla. Para cada permiso sensible, Google pide
una justificación. Textos propuestos:

- **calendar.events:** «MarchaSolo es un asistente para pequeños negocios. El
  usuario le pregunta por su agenda ("¿qué reuniones tengo mañana?") y le pide
  crear o mover citas. La app lee los eventos para responder y prepara los
  cambios, que el usuario revisa y aprueba en pantalla antes de que se
  guarden en su calendario. No se crean ni cambian eventos sin esa
  aprobación.»
- **calendar.calendarlist.readonly:** «Se usa solo para mostrar al usuario la
  lista de sus calendarios y que elija en cuál trabaja MarchaSolo. No se
  modifica ningún calendario con este permiso.»

**Google Auth Platform → Audience**

- Tipo de usuario: Externo.
- Estado: pulsa **Publish app** (pasa de «Testing» a «In production»).

**Google Auth Platform → Verification Center**

Envía la verificación. Google suele pedir:

- **Vídeo de demostración** (subido a YouTube como «no listado»). Guion:
  1. Muestra la barra de direcciones con tu dominio y entra en MarchaSolo.
  2. Abre Integraciones → Calendar y pulsa Conectar.
  3. Enseña la pantalla de consentimiento de Google con el nombre MarchaSolo,
     la URL del cliente y los permisos. Acepta.
  4. En el chat, pregunta «¿Qué reuniones tengo mañana?» y enseña la
     respuesta con tus eventos.
  5. Pide «Crea una reunión mañana a las 10 con Laura» y enseña la tarjeta de
     aprobación con los datos del evento. Apruébala y enseña el evento creado
     en Google Calendar.
  6. Enseña cómo se desconecta (Integraciones → Calendar → Desconectar).
  - Haz lo mismo, más corto, con Drive: conectar, elegir un archivo en el
    selector de Google y usarlo en una automatización.
- **Respuesta a sus correos** en el plazo que indiquen. Suelen escribir al
  correo de contacto del desarrollador.

Plazo habitual: unos días para la marca; de una a varias semanas para los
permisos sensibles.

## Mientras tanto

Con la app publicada pero sin verificar:

- **Drive** funciona para cualquiera sin avisos (su permiso no es sensible).
- **Calendar** funciona, pero el usuario ve «Google no ha verificado esta
  app» y tiene que pulsar «Configuración avanzada → Ir a MarchaSolo». Google
  limita a 100 los usuarios que pueden conectar así.
- Ya no hace falta apuntar a nadie como usuario de prueba, y los permisos no
  caducan cada 7 días.
