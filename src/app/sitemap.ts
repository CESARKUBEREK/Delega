import type { MetadataRoute } from "next"

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://marchasolo.com").replace(/\/+$/, "")
const PAGES = [
  "/",
  "/para-que-sirve",
  "/como-funciona",
  "/integraciones",
  "/casos-de-uso",
  "/precios",
  "/crear-cuenta",
  "/privacidad",
  "/terminos",
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${SITE}${path === "/" ? "" : path}`,
    changeFrequency: "monthly" as const,
    priority: path === "/" ? 1 : 0.7,
  }))
}
