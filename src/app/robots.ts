import type { MetadataRoute } from "next"

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://marchasolo.com").replace(/\/+$/, "")

// Solo las páginas públicas; la app (/w) y los retornos de OAuth, fuera.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/w/", "/abrir", "/auth/", "/integraciones/", "/invite", "/hablar/", "/reset-password"] },
    sitemap: `${SITE}/sitemap.xml`,
  }
}
