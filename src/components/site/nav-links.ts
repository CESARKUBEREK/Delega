// Navegación del sitio público (independiente de la de la app).
export const SITE_LINKS = [
  { href: "/para-que-sirve", label: "Para qué sirve" },
  { href: "/como-funciona", label: "Cómo funciona" },
  { href: "/integraciones", label: "Integraciones" },
  { href: "/casos-de-uso", label: "Casos de uso" },
  { href: "/precios", label: "Precios" },
] as const

// Contacto y redes del pie. Las redes sin dirección se muestran como texto
// hasta que se rellene su enlace.
export const CONTACT_EMAIL = "hola@marchasolo.com"

export const SOCIAL_LINKS: { label: string; href: string }[] = [
  { label: "LinkedIn", href: "" },
  { label: "Instagram", href: "" },
  { label: "X", href: "" },
]
