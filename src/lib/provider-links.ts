// Dónde se consigue cada clave: la página exacta de la consola de cada
// proveedor. Se abren en otra pestaña desde Integraciones y el onboarding
// (componente ExternalLink). Si un proveedor cambia de dirección, se cambia
// aquí y en ningún otro sitio.
export type ProviderLink = { href: string; label: string }

export const PROVIDER_LINKS = {
  openai: { href: "https://platform.openai.com/api-keys", label: "Crear mi clave en OpenAI" },
  anthropic: { href: "https://platform.claude.com/settings/keys", label: "Crear mi clave en Anthropic" },
  deepseek: { href: "https://platform.deepseek.com/api_keys", label: "Crear mi clave en DeepSeek" },
  xai: { href: "https://console.x.ai", label: "Crear mi clave en xAI" },
  hubspot: { href: "https://app.hubspot.com/login", label: "Abrir HubSpot" },
  hubspotEu: { href: "https://app-eu1.hubspot.com/login", label: "HubSpot (cuentas en Europa)" },
  tokko: { href: "https://www.tokkobroker.com/", label: "Abrir Tokko Broker" },
  xubio: { href: "https://xubio.com/", label: "Abrir Xubio" },
  buffer: { href: "https://publish.buffer.com/settings/api", label: "Abrir la API de Buffer" },
  telegram: { href: "https://t.me/BotFather", label: "Abrir @BotFather en Telegram" },
  twilio: { href: "https://console.twilio.com/", label: "Abrir la consola de Twilio" },
  gmailTwoStep: { href: "https://myaccount.google.com/signinoptions/twosv", label: "Activar la verificación en dos pasos" },
  gmailAppPassword: { href: "https://myaccount.google.com/apppasswords", label: "Crear una contraseña de aplicación de Google" },
  supabase: { href: "https://supabase.com/dashboard", label: "Abrir Supabase" },
} satisfies Record<string, ProviderLink>
