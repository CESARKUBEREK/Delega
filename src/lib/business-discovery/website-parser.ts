export type WebsitePage = {
  url: string
  title: string | null
  description: string | null
  headings: string[]
  text: string
  language?: string | null
  siteName?: string | null
  canonicalUrl?: string | null
  keywords?: string[]
  contentQuality?: "usable" | "metadata_only" | "javascript_shell"
}

export type WebsiteSnapshot = WebsitePage & { pages: WebsitePage[] }
export type ParsedWebsitePage = WebsitePage & { links: string[] }

function decodeCodePoint(raw: string, radix = 10): string {
  const point = parseInt(raw, radix)
  return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
    ? String.fromCodePoint(point) : "�"
}

function decodeEntities(value: string): string {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => decodeCodePoint(n))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => decodeCodePoint(n, 16))
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim()
}

function readMetaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attrs: Record<string, string> = {}
      for (const match of tag[0].matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) attrs[match[1].toLowerCase()] = decodeEntities(match[3].trim())
      const identity = (attrs.name ?? attrs.property ?? attrs.itemprop ?? "").toLowerCase()
      if (identity === key && attrs.content) return cleanText(attrs.content).slice(0, 500) || null
    }
  }
  return null
}

function stripNonContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template|nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(?:div|section)[^>]*(?:role\s*=\s*["'](?:navigation|contentinfo|banner)["']|aria-hidden\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/(?:div|section)\s*>/gi, " ")
}

export function parseWebsiteHtml(html: string, url: string): ParsedWebsitePage {
  const safeHtml = stripNonContent(html)
  const htmlTitle = cleanText(safeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
  const title = readMetaContent(safeHtml, ["og:title", "twitter:title"]) ?? htmlTitle
  const description = readMetaContent(safeHtml, ["description", "og:description", "twitter:description"])
  const siteName = readMetaContent(safeHtml, ["og:site_name"])
  const language = safeHtml.match(/<html\b[^>]*\blang\s*=\s*(["'])(.*?)\1/i)?.[2]?.trim().slice(0, 20) ?? null
  const canonicalHref = safeHtml.match(/<link\b(?=[^>]*\brel\s*=\s*(["'])canonical\1)[^>]*\bhref\s*=\s*(["'])(.*?)\2[^>]*>/i)?.[3]
  let canonicalUrl: string | null = null
  if (canonicalHref) {
    try {
      const candidate = new URL(decodeEntities(canonicalHref), url)
      if (candidate.protocol === "https:" || candidate.protocol === "http:") canonicalUrl = candidate.toString().slice(0, 2_048)
    } catch { canonicalUrl = null }
  }
  const rawKeywords = readMetaContent(safeHtml, ["keywords"])
  const keywords = rawKeywords ? [...new Set(rawKeywords.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 12) : []
  const headings = [...safeHtml.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]\s*>/gi)]
    .map((m) => cleanText(m[1])).filter((item) => item.length >= 3 && item.length <= 180).slice(0, 12)
  const mainContent = safeHtml.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)\s*>/i)?.[1]
  const body = mainContent ?? safeHtml.match(/<body[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? safeHtml
  const text = cleanText(body).slice(0, 12_000)
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)]
    .map((m) => decodeEntities(m[2].trim())).filter(Boolean).slice(0, 150)
  const appShell = /<div[^>]+id=["'](?:__next|root|app)["'][^>]*>\s*<\/div>/i.test(html)
    || /__NEXT_DATA__|data-reactroot|ng-version=/i.test(html)
  const contentQuality = text.length >= 30 ? "usable" : (appShell || (text.length < 80 && /<script\b/i.test(html))) ? "javascript_shell" : "metadata_only"
  return { url, title: title || null, description, headings, text, links, language, siteName, canonicalUrl, keywords, contentQuality }
}

/** Selects at most two useful same-origin pages, prioritizing substantive business content. */
export function selectRelevantWebsiteLinks(links: string[], baseUrl: string, limit = 2): string[] {
  let base: URL
  try { base = new URL(baseUrl) } catch { return [] }
  const candidates = new Map<string, { url: string; score: number; order: number }>()
  const patterns = [
    { score: 6, regex: /(?:^|\/)(?:servicios?|services?|productos?|products?|soluciones?|solutions?|oferta|what-we-do|expertise)(?:\/|$)/i },
    { score: 5, regex: /(?:^|\/)(?:research|investigacion|investigación|reports?|reportes?|informes?|insights?|intelligence|inteligencia|analysis|analisis|análisis|market|mercados?|publications?|publicaciones?|country-risk)(?:\/|$)/i },
    { score: 4, regex: /(?:^|\/)(?:sectors?|sectores?|industries|industrias|areas|áreas|capabilities|capacidades|our-work|proyectos|projects|casos-de-exito)(?:\/|$)/i },
    { score: 3, regex: /(?:^|\/)(?:nosotros|quienes-somos|about|empresa|company|equipo|team)(?:\/|$)/i },
    { score: 1, regex: /(?:^|\/)(?:contacto|contact|presupuesto|cita|reservas?)(?:\/|$)/i },
  ]
  links.forEach((href, order) => {
    try {
      const url = new URL(href, base)
      if (url.origin !== base.origin || url.username || url.password || !["https:", "http:"].includes(url.protocol)) return
      if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) return
      url.hash = ""; url.search = ""
      if (url.pathname === "/" || /\.(?:pdf|jpg|jpeg|png|gif|webp|svg|zip|xml|json)$/i.test(url.pathname)) return
      const score = patterns.find((item) => item.regex.test(url.pathname))?.score ?? 0
      if (!score) return
      const key = url.href.replace(/\/$/, "") || url.origin
      const previous = candidates.get(key)
      if (!previous || score > previous.score) candidates.set(key, { url: url.href, score, order })
    } catch { /* Ignore malformed or non-web links. */ }
  })
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, Math.max(0, Math.min(2, limit))).map((item) => item.url)
}

export function isSameOriginWebsiteUrl(baseUrl: string, candidateUrl: string): boolean {
  try { return new URL(baseUrl).origin === new URL(candidateUrl).origin } catch { return false }
}

export function combineWebsitePages(pages: WebsitePage[]): WebsiteSnapshot {
  const uniquePages = [...new Map(pages.map((page) => [page.url, page])).values()].slice(0, 3)
  const primary = uniquePages[0]
  if (!primary) throw new Error("No hay páginas válidas para analizar.")
  return { ...primary, pages: uniquePages }
}
