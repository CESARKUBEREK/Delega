import type { MetadataRoute } from "next"

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://marchasolo.com").replace(/\/+$/, "")
const PAGES = ["/", "/para-que-sirve", "/como-funciona", "/casos-de-uso", "/precios", "/crear-cuenta", "/privacidad", "/terminos"]

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `${SITE}${path === "/" ? "" : path}`, changeFrequency: "monthly", priority: path === "/" ? 1 : 0.7 }))
}
