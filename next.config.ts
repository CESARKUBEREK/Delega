import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const supabaseWs = supabaseUrl.replace(/^https:/, "wss:")

// CSP sin nonces (permite el prerenderizado). Solo se conecta con el propio
// sitio y con Supabase. El único script de terceros es el selector de
// archivos de Google (apis.google.com), que se abre en un iframe de docs.google.com,
// y el CAPTCHA de Cloudflare Turnstile en los formularios de acceso.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://apis.google.com https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://lh3.googleusercontent.com https://*.gstatic.com",
  "font-src 'self'",
  // wss://api.x.ai: voz en tiempo real (asistente en la web y ayudante por voz).
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} wss://api.x.ai`.trim(),
  "frame-src https://docs.google.com https://drive.google.com https://accounts.google.com https://challenges.cloudflare.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  // Los formularios de OAuth redirigen a Supabase y de ahí a Google/Microsoft.
  `form-action 'self' ${supabaseUrl} https://accounts.google.com https://login.microsoftonline.com`.trim(),
  "frame-ancestors 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ")

// Asistente de voz en la web del cliente (/hablar/<id>): se inserta en otras
// webs (frame-ancestors *) y habla con xAI por WebSocket (ya permitido arriba).
const voiceCsp = csp.replace("frame-ancestors 'none'", "frame-ancestors *")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // El micrófono solo lo usa el dictado del asistente, en el propio sitio.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // El selector de Google abre ventanas emergentes que hablan con esta página.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // El asistente de configuración /bienvenida se retiró (1 nov): lo sustituye
  // el onboarding. Los enlaces antiguos llevan allí.
  async redirects() {
    return [
      { source: "/w/:workspaceId/bienvenida", destination: "/w/:workspaceId/onboarding", permanent: false },
      // Rutas de acceso en español (2 nov): los enlaces antiguos siguen
      // funcionando y conservan ?next=. /como-empezar pasa a /como-funciona.
      { source: "/login", destination: "/entrar", permanent: true },
      { source: "/signup", destination: "/crear-cuenta", permanent: true },
      { source: "/como-empezar", destination: "/como-funciona#empezar", permanent: true },
    ]
  },
  async headers() {
    return [
      { source: "/((?!hablar/).*)", headers: securityHeaders },
      {
        source: "/hablar/:path*",
        headers: [
          { key: "Content-Security-Policy", value: voiceCsp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      { source: "/widget-voz.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
      // El service worker siempre se descarga de nuevo, para que las versiones nuevas lleguen enseguida.
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
