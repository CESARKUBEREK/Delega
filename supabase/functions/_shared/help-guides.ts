// Fichas de ayuda de cada integración (y de las automatizaciones): requisitos,
// pasos y errores típicos, con el mismo texto que las tarjetas de
// Integraciones. Las usa el ayudante (acción «help» de la función assistant)
// y el panel «¿Te ayudo?» como preguntas frecuentes cuando no hay IA.
// Solo datos: este archivo lo importan Deno y Next.js.

export type HelpGuide = {
  id: string
  title: string
  // Sección de Integraciones donde está la tarjeta (ancla).
  section: string
  keywords: string[]
  summary: string
  steps: string[]
  errors: { q: string; a: string }[]
}

export const HELP_GUIDES: HelpGuide[] = [
  {
    "id": "openai",
    "title": "OpenAI (GPT)",
    "section": "llms",
    "keywords": [
      "openai",
      "gpt",
      "chatgpt"
    ],
    "summary": "Modelos GPT. Es también la que transcribe el dictado por voz.",
    "steps": [
      "Entra en platform.openai.com con tu cuenta y abre «API keys».",
      "Crea una clave nueva para MarchaSolo y cópiala. Tu cuenta de OpenAI necesita saldo o un método de pago.",
      "Pégala en la tarjeta de OpenAI: MarchaSolo la comprueba y la guarda cifrada; nadie puede volver a verla."
    ],
    "errors": [
      {
        "q": "La clave no funciona",
        "a": "Comprueba que la copiaste entera, sin espacios, y que tu cuenta del proveedor tiene saldo o un método de pago. Si la borraste en el proveedor, crea otra."
      },
      {
        "q": "¿Quién paga el consumo?",
        "a": "Tu cuenta del proveedor. MarchaSolo anota en Historial cuántos tokens usa cada petición."
      }
    ]
  },
  {
    "id": "anthropic",
    "title": "Anthropic (Claude)",
    "section": "llms",
    "keywords": [
      "anthropic",
      "claude"
    ],
    "summary": "Modelos Claude, de Anthropic.",
    "steps": [
      "Entra en platform.claude.com con tu cuenta y abre «API Keys».",
      "Crea una clave nueva para MarchaSolo y cópiala (empieza por sk-ant-). Tu cuenta necesita créditos.",
      "Pégala en la tarjeta de Anthropic."
    ],
    "errors": [
      {
        "q": "La clave no funciona",
        "a": "Comprueba que la copiaste entera, sin espacios, y que tu cuenta del proveedor tiene saldo o un método de pago. Si la borraste en el proveedor, crea otra."
      },
      {
        "q": "¿Quién paga el consumo?",
        "a": "Tu cuenta del proveedor. MarchaSolo anota en Historial cuántos tokens usa cada petición."
      }
    ]
  },
  {
    "id": "deepseek",
    "title": "DeepSeek",
    "section": "llms",
    "keywords": [
      "deepseek"
    ],
    "summary": "Modelos DeepSeek: muy económicos. Procesa los datos fuera de la UE.",
    "steps": [
      "Entra en platform.deepseek.com con tu cuenta y abre «API keys».",
      "Crea una clave nueva para MarchaSolo y cópiala. Tu cuenta necesita saldo.",
      "Pégala en la tarjeta de DeepSeek."
    ],
    "errors": [
      {
        "q": "La clave no funciona",
        "a": "Comprueba que la copiaste entera, sin espacios, y que tu cuenta del proveedor tiene saldo o un método de pago. Si la borraste en el proveedor, crea otra."
      },
      {
        "q": "¿Quién paga el consumo?",
        "a": "Tu cuenta del proveedor. MarchaSolo anota en Historial cuántos tokens usa cada petición."
      }
    ]
  },
  {
    "id": "xai",
    "title": "Grok (xAI)",
    "section": "llms",
    "keywords": [
      "grok",
      "xai"
    ],
    "summary": "Modelos Grok, de xAI. Procesa los datos en Estados Unidos.",
    "steps": [
      "Entra en console.x.ai con tu cuenta y abre «API Keys».",
      "Crea una clave nueva para MarchaSolo y cópiala (empieza por xai-). Tu cuenta necesita créditos.",
      "Pégala en la tarjeta de Grok."
    ],
    "errors": [
      {
        "q": "La clave no funciona",
        "a": "Comprueba que la copiaste entera, sin espacios, y que tu cuenta del proveedor tiene saldo o un método de pago. Si la borraste en el proveedor, crea otra."
      },
      {
        "q": "¿Quién paga el consumo?",
        "a": "Tu cuenta del proveedor. MarchaSolo anota en Historial cuántos tokens usa cada petición."
      }
    ]
  },
  {
    "id": "drive",
    "title": "Google Drive",
    "section": "drives",
    "keywords": [
      "drive",
      "google drive",
      "carpeta",
      "archivo",
      "pdf",
      "word"
    ],
    "summary": "La conexión que usan Sheets, Excel y Docs. Solo abre los archivos y carpetas que elijas; no ve el resto de tu Drive.",
    "steps": [
      "En la tarjeta de Google Drive, pulsa «Conectar» y elige tu cuenta de Google.",
      "Acepta los permisos que pide Google.",
      "De vuelta en MarchaSolo, elige las carpetas y archivos que puede usar."
    ],
    "errors": [
      {
        "q": "Google dice que la app no está verificada",
        "a": "MarchaSolo está en verificación con Google. Pulsa «Configuración avanzada» y después «Ir a MarchaSolo». Si Google bloquea el acceso, pide al administrador de MarchaSolo que añada tu correo de Google como usuario de prueba."
      },
      {
        "q": "Pone «Google retiró el acceso»",
        "a": "Vuelve a conectar la cuenta desde la tarjeta."
      },
      {
        "q": "Falta un archivo en una carpeta",
        "a": "En una carpeta, MarchaSolo ve los archivos que Google le permite. Si falta alguno, elígelo también por separado."
      }
    ]
  },
  {
    "id": "sheets",
    "title": "Google Sheets",
    "section": "calculos",
    "keywords": [
      "sheets",
      "planilla",
      "hoja de cálculo",
      "google sheets"
    ],
    "summary": "Planillas de Google: leer rangos, añadir filas y actualizar celdas. Las escrituras esperan tu aprobación.",
    "steps": [
      "Conecta primero Google Drive.",
      "En la tarjeta de Google Sheets, pulsa «Elegir planillas» y selecciónalas en el selector de Google."
    ],
    "errors": [
      {
        "q": "Google dice que la app no está verificada",
        "a": "MarchaSolo está en verificación con Google. Pulsa «Configuración avanzada» y después «Ir a MarchaSolo». Si Google bloquea el acceso, pide al administrador de MarchaSolo que añada tu correo de Google como usuario de prueba."
      },
      {
        "q": "Pone «Google retiró el acceso»",
        "a": "Vuelve a conectar la cuenta desde la tarjeta."
      }
    ]
  },
  {
    "id": "excel",
    "title": "Excel en Drive",
    "section": "calculos",
    "keywords": [
      "excel",
      "xlsx"
    ],
    "summary": "Archivos Excel guardados en tu Google Drive. Leer y, con tu aprobación, añadir filas y actualizar celdas (.xlsx). Los .xls antiguos y los libros con gráficos o tablas dinámicas, solo lectura.",
    "steps": [
      "Sube el Excel a tu Google Drive si aún no está.",
      "Conecta Google Drive.",
      "En la tarjeta de Excel, pulsa «Elegir archivos Excel»."
    ],
    "errors": [
      {
        "q": "Google dice que la app no está verificada",
        "a": "MarchaSolo está en verificación con Google. Pulsa «Configuración avanzada» y después «Ir a MarchaSolo». Si Google bloquea el acceso, pide al administrador de MarchaSolo que añada tu correo de Google como usuario de prueba."
      },
      {
        "q": "Pone «Google retiró el acceso»",
        "a": "Vuelve a conectar la cuenta desde la tarjeta."
      }
    ]
  },
  {
    "id": "docs",
    "title": "Google Docs",
    "section": "textos",
    "keywords": [
      "docs",
      "documento",
      "google docs"
    ],
    "summary": "Documentos que las automatizaciones leen, completan o crean.",
    "steps": [
      "Conecta Google Drive.",
      "En la tarjeta de Google Docs, elige los documentos."
    ],
    "errors": [
      {
        "q": "Google dice que la app no está verificada",
        "a": "MarchaSolo está en verificación con Google. Pulsa «Configuración avanzada» y después «Ir a MarchaSolo». Si Google bloquea el acceso, pide al administrador de MarchaSolo que añada tu correo de Google como usuario de prueba."
      },
      {
        "q": "Pone «Google retiró el acceso»",
        "a": "Vuelve a conectar la cuenta desde la tarjeta."
      }
    ]
  },
  {
    "id": "calendar",
    "title": "Google Calendar",
    "section": "calendar",
    "keywords": [
      "calendar",
      "calendario",
      "agenda",
      "citas",
      "reuniones"
    ],
    "summary": "Tu agenda: consultar y proponer eventos. Crear o cambiar eventos espera tu aprobación.",
    "steps": [
      "En la tarjeta de Google Calendar, pulsa «Conectar» y elige tu cuenta de Google.",
      "Google te pedirá permiso para ver y editar los eventos de tus calendarios.",
      "Elige en qué calendario trabaja MarchaSolo."
    ],
    "errors": [
      {
        "q": "Google dice que la app no está verificada",
        "a": "MarchaSolo está en verificación con Google. Pulsa «Configuración avanzada» y después «Ir a MarchaSolo». Si Google bloquea el acceso, pide al administrador de MarchaSolo que añada tu correo de Google como usuario de prueba."
      },
      {
        "q": "Pone «Google retiró el acceso»",
        "a": "Vuelve a conectar la cuenta desde la tarjeta."
      }
    ]
  },
  {
    "id": "contacts",
    "title": "Google Contacts",
    "section": "crm",
    "keywords": [
      "contactos",
      "google contacts",
      "clientes"
    ],
    "summary": "Para quien no usa un CRM: busca a tus clientes en tus contactos de Google y crea los nuevos con tu aprobación.",
    "steps": [
      "En la tarjeta de Google Contacts, pulsa «Conectar» y elige tu cuenta de Google.",
      "Google te pedirá permiso para ver y crear contactos."
    ],
    "errors": [
      {
        "q": "Google dice que la app no está verificada",
        "a": "MarchaSolo está en verificación con Google. Pulsa «Configuración avanzada» y después «Ir a MarchaSolo». Si Google bloquea el acceso, pide al administrador de MarchaSolo que añada tu correo de Google como usuario de prueba."
      },
      {
        "q": "Pone «Google retiró el acceso»",
        "a": "Vuelve a conectar la cuenta desde la tarjeta."
      }
    ]
  },
  {
    "id": "imap",
    "title": "Correo (IMAP/SMTP)",
    "section": "comunicaciones",
    "keywords": [
      "correo",
      "email",
      "mail",
      "gmail",
      "imap",
      "smtp",
      "bandeja",
      "hosting",
      "ovh",
      "ionos",
      "hostinger"
    ],
    "summary": "Tu correo de Gmail, de tu dominio o de tu hosting. MarchaSolo lee la bandeja de entrada (no borra, no mueve ni marca nada como leído) y envía solo lo que apruebes, por el puerto 465.",
    "steps": [
      "En la tarjeta de Correo, escribe tu dirección y elige tu proveedor: se rellenan los servidores (por ejemplo imap.gmail.com y smtp.gmail.com).",
      "Escribe la contraseña. Si tu proveedor ofrece «contraseñas de aplicación», crea una para MarchaSolo y úsala.",
      "Pulsa conectar: MarchaSolo comprueba la lectura (IMAP, puerto 993) y el envío (SMTP, puerto 465)."
    ],
    "errors": [
      {
        "q": "Gmail rechaza la contraseña",
        "a": "Gmail no admite tu contraseña normal. 1) Activa la verificación en dos pasos (myaccount.google.com/signinoptions/twosv). 2) Crea una contraseña de aplicación con el nombre «MarchaSolo» (myaccount.google.com/apppasswords). 3) Pega las 16 letras en Contraseña; los espacios dan igual. Si Google dice que la opción no está disponible, falta el paso 1. En Google Workspace, el administrador tiene que permitir IMAP."
      },
      {
        "q": "Falla el envío por SMTP",
        "a": "MarchaSolo solo envía por el puerto 465 (cifrado). Si tu proveedor solo admite el 587, no se puede enviar desde aquí; la comprobación te lo dirá."
      },
      {
        "q": "Uso Outlook o Microsoft 365",
        "a": "Todavía no se puede: Microsoft no admite este método y tendrá su propia conexión más adelante."
      },
      {
        "q": "No veo mis correos",
        "a": "La primera vez trae los 400 más recientes de los últimos 30 días; después se sincroniza cada pocos minutos."
      }
    ]
  },
  {
    "id": "telegram",
    "title": "Telegram",
    "section": "comunicaciones",
    "keywords": [
      "telegram",
      "bot",
      "botfather"
    ],
    "summary": "Pídele cosas a MarchaSolo por Telegram (texto o voz) y aprueba con un toque.",
    "steps": [
      "En Telegram, abre una conversación con @BotFather (tiene la marca de verificación azul).",
      "Envía /newbot, elige un nombre visible y un usuario que termine en «bot».",
      "BotFather te responde con un token (números, dos puntos y letras). Pégalo en la tarjeta de Telegram, no en el chat."
    ],
    "errors": [
      {
        "q": "El bot no responde",
        "a": "Comprueba que el token es el último que te dio BotFather y que escribes al bot correcto."
      }
    ]
  },
  {
    "id": "whatsapp",
    "title": "WhatsApp (Twilio)",
    "section": "comunicaciones",
    "keywords": [
      "whatsapp",
      "twilio"
    ],
    "summary": "A través de Twilio, proveedor oficial de WhatsApp. Los mensajes de tus clientes llegan a la bandeja.",
    "steps": [
      "Crea una cuenta en twilio.com (te pedirá verificar tu correo y tu teléfono).",
      "En la consola, copia el Account SID y el Auth Token y pégalos en la tarjeta. Deja vacío el número para usar el de pruebas.",
      "En Twilio, abre Messaging → Try it out → Send a WhatsApp message y une tu WhatsApp al número de pruebas.",
      "En Sandbox settings, pega la dirección que te da la tarjeta en «When a message comes in», con el método POST."
    ],
    "errors": [
      {
        "q": "Solo pueden escribir algunos números",
        "a": "Es el entorno de pruebas de Twilio: solo escriben los números unidos con «join …», y la unión caduca a los 3 días. Para tu propio número hay que darlo de alta en Twilio con verificación de Meta."
      },
      {
        "q": "¿Cuánto tarda conectar mi propio número?",
        "a": "Dar de alta el número en Twilio (Messaging → Senders → WhatsApp senders) lleva alrededor de una hora y pide una cuenta de Meta Business. Funciona enseguida, pero con límites, hasta que Meta verifica tu negocio: puede tardar una o dos semanas y pide documentos legales. El nombre que se muestra debe coincidir con el de tu negocio en Meta. Mientras tanto, puedes usar MarchaSolo con tu correo."
      }
    ]
  },
  {
    "id": "hubspot",
    "title": "HubSpot",
    "section": "crm",
    "keywords": [
      "hubspot",
      "crm"
    ],
    "summary": "Contactos, empresas y negocios de tu CRM. Leer libremente; crear y actualizar con tu aprobación.",
    "steps": [
      "En HubSpot, abre Desarrollo → Claves → Claves de servicio y pulsa «Crear clave de servicio».",
      "Crea la clave, cópiala y pégala en la tarjeta de HubSpot."
    ],
    "errors": []
  },
  {
    "id": "tokko",
    "title": "Tokko Broker",
    "section": "inmobiliaria",
    "keywords": [
      "tokko",
      "propiedades",
      "inmobiliaria"
    ],
    "summary": "Tu cartera de propiedades: buscar fichas y registrar consultas de interesados.",
    "steps": [
      "Entra en Tokko Broker con un usuario administrador.",
      "Abre «Mi empresa» → «Permisos» y copia la clave de API («API Key»).",
      "Pégala en la tarjeta de Tokko."
    ],
    "errors": []
  },
  {
    "id": "xubio",
    "title": "Xubio",
    "section": "contabilidad",
    "keywords": [
      "xubio",
      "contabilidad",
      "facturas"
    ],
    "summary": "Tus datos contables, solo lectura: clientes, proveedores, productos y facturas. MarchaSolo no emite facturas.",
    "steps": [
      "En Xubio, abre «Configuración» → «Integraciones» → «API de Xubio».",
      "Pulsa «Nueva App Cliente», ponle de nombre «MarchaSolo» y guarda.",
      "Copia el Client ID y el Secret ID y pégalos en la tarjeta de Xubio."
    ],
    "errors": []
  },
  {
    "id": "buffer",
    "title": "Buffer (redes sociales)",
    "section": "redes-sociales",
    "keywords": [
      "buffer",
      "redes",
      "instagram",
      "facebook",
      "linkedin",
      "publicar"
    ],
    "summary": "Publicaciones en tus redes, redactadas por MarchaSolo y aprobadas por ti.",
    "steps": [
      "Entra en buffer.com y conecta allí tus redes sociales si aún no lo has hecho.",
      "Abre «Settings» → «API» y crea una clave para MarchaSolo.",
      "Pégala en la tarjeta de Buffer. El plan gratuito de Buffer incluye la API."
    ],
    "errors": []
  },
  {
    "id": "voice-phone",
    "title": "Atención por teléfono (Grok Voice)",
    "section": "asistente-voz",
    "keywords": [
      "teléfono",
      "llamadas",
      "voz",
      "grok voice"
    ],
    "summary": "Un agente de voz atiende las llamadas: consulta tu agenda y reserva citas, toma mensajes y responde con tus documentos.",
    "steps": [
      "Conecta Google Calendar para que pueda reservar citas.",
      "En la tarjeta «Por teléfono», crea el acceso para el agente de voz.",
      "En console.x.ai → Voice Agents, crea un agente «Custom», pega el guion que te da la tarjeta y elige una voz."
    ],
    "errors": []
  },
  {
    "id": "voice-web",
    "title": "Asistente de voz en tu web",
    "section": "asistente-voz",
    "keywords": [
      "web",
      "widget",
      "voz en la web"
    ],
    "summary": "Un botón en la web de tu negocio para hablar con tu asistente de voz: reserva citas y toma mensajes.",
    "steps": [
      "En Integraciones → Asistente de voz → «En tu web», crea el asistente y pruébalo.",
      "Actívalo, indica los dominios de tu web y copia el código.",
      "Pega el código en tu web."
    ],
    "errors": []
  },
  {
    "id": "automatizaciones",
    "title": "Crear una automatización",
    "section": "automatizaciones",
    "keywords": [
      "automatización",
      "automatizar",
      "plantilla",
      "programar",
      "rutina",
      "flujo"
    ],
    "summary": "Tres caminos: pedírsela al asistente en el chat, empezar por una plantilla (por rutina o por sector) o crearla desde cero.",
    "steps": [
      "En Automatizaciones, pulsa «Pedírsela al asistente» y cuéntale la tarea con tus palabras.",
      "Revisa el plan: puedes ejecutarlo ahora o guardarlo como automatización.",
      "Para que arranque sola, elige cuándo (cada día, días laborables, un día de la semana o del mes) en «Programación»."
    ],
    "errors": [
      {
        "q": "¿Se envía algo sin que yo lo vea?",
        "a": "No. MarchaSolo lee libremente, pero todo lo que escribe o envía a otras personas espera tu aprobación en Aprobaciones."
      },
      {
        "q": "Mi automatización falló",
        "a": "Abre la ejecución en Historial: verás el paso y el error. Lo habitual es una conexión caducada; vuelve a conectarla en Integraciones."
      }
    ]
  }
]

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")

// Las fichas que vienen al caso: la de la tarjeta desde la que se abrió la
// ayuda y las que más coinciden con lo que se pregunta (como mucho 4).
export function relevantGuides(text: string, focus?: string | null): HelpGuide[] {
  const t = norm(text)
  const scored = HELP_GUIDES.map((g) => ({
    g,
    score: (g.id === focus ? 100 : 0) + g.keywords.filter((k) => t.includes(norm(k))).length + (t.includes(norm(g.title)) ? 2 : 0),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, 4).map((x) => x.g)
}

// ¿Parece que el texto lleva una clave, un token o una contraseña? Así no
// llega nunca a la IA ni se queda en la conversación.
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/, // OpenAI, Anthropic, DeepSeek
  /\bxai-[A-Za-z0-9_-]{16,}/, // xAI
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}/, // token de bot de Telegram
  /\bAC[a-f0-9]{32}\b/i, // Twilio Account SID
  /\bpat-[a-z0-9]{2,4}-[A-Za-z0-9-]{20,}/, // HubSpot
  /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/, // cadenas largas al azar
  /(contrase[nñ]a|password|passwd|clave|token|api ?key|secret)\w*\s*(?:es|:|=)\s*\S{6,}/i,
]

export function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text))
}

export const SECRET_REPLY =
  "Parece que has escrito una clave o una contraseña. No la he enviado a la IA ni la he guardado. Las claves solo se pegan en la tarjeta de su integración, donde se guardan cifradas. Si quieres, te abro la tarjeta."
