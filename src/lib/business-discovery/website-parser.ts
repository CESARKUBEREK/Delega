export type WebsitePage = {
  url: string
  title: string | null
  description: string | null
  headings: string[]
  text: string
}

export type WebsiteSnapshot = WebsitePage & {
  pages: WebsitePage[]
}

export type ParsedWebsitePage = WebsitePage & {
  links: string[]
}

function decodeCodePoint(raw: string, radix = 10): string {
  const point = parseInt(raw, radix)
  return Number.isInteger(point) && point >= 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
    ? String.fromCodePoint(point)
    : "�"
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => decodeCodePoint(n))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => decodeCodePoint(n, 16))
}

function cleanText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim()
}

export function parseWebsiteHtml(html: string, url: string): ParsedWebsitePage {
  const withoutExecutableContent = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")

  const title = cleanText(withoutExecutableContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
  const description = cleanText(
    withoutExecutableContent.match(/<meta\s+[^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1] ??
    withoutExecutableContent.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:description|og:description)["'][^>]*>/i)?.[1] ?? "",
  )
  const headings = [...withoutExecutableContent.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]\s*>/gi)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .slice(0, 12)
  const body = withoutExecutableContent.match(/<body[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? withoutExecutableContent
  const text = cleanText(body).slice(0, 12_000)
  const links = [...withoutExecutableContent.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>/gi)]
    .map((match) => decodeEntities(match[2].trim()))
    .filter(Boolean)
    .slice(0, 150)

  return { url, title: title || null, description: description || null, headings, text, links }
}

/** Selects at most two relevant links from the same origin; never follows arbitrary links. */
export function selectRelevantWebsiteLinks(links: string[], baseUrl: string, limit = 2): string[] {
  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    return []
  }

  const candidates = new Map<string, { url: string; score: number; order: number }>()
  const servicePath = /(?:^|\/)(?:servicios?|services?|productos?|products?|soluciones?|solutions?|oferta|what-we-do)(?:\/|$)/i
  const contactPath = /(?:^|\/)(?:contacto|contact|presupuesto|cita|reservas?)(?:\/|$)/i
  const aboutPath = /(?:^|\/)(?:nosotros|quienes-somos|about|empresa|company|equipo|team)(?:\/|$)/i

  links.forEach((href, order) => {
    try {
      const url = new URL(href, base)
      if (url.origin !== base.origin || url.username || url.password) return
      if (url.protocol !== "https:" && url.protocol !== "http:") return
      if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) return
      url.hash = ""
      url.search = ""
      if (url.pathname === "/" || /\.(?:pdf|jpg|jpeg|png|gif|webp|svg|zip|xml|json)$/i.test(url.pathname)) return
      const score = servicePath.test(url.pathname) ? 3 : contactPath.test(url.pathname) ? 2 : aboutPath.test(url.pathname) ? 1 : 0
      if (!score) return
      const key = url.href.replace(/\/$/, "") || url.origin
      const previous = candidates.get(key)
      if (!previous || score > previous.score) candidates.set(key, { url: url.href, score, order })
    } catch {
      // Ignora enlaces malformados o esquemas no web.
    }
  })

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, Math.max(0, Math.min(2, limit)))
    .map((item) => item.url)
}

export function isSameOriginWebsiteUrl(baseUrl: string, candidateUrl: string): boolean {
  try {
    return new URL(baseUrl).origin === new URL(candidateUrl).origin
  } catch {
    return false
  }
}

/** Keeps the primary page first, removes redirect duplicates and caps the snapshot at three pages. */
export function combineWebsitePages(pages: WebsitePage[]): WebsiteSnapshot {
  const uniquePages = [...new Map(pages.map((page) => [page.url, page])).values()].slice(0, 3)
  const primary = uniquePages[0]
  if (!primary) throw new Error("No hay páginas válidas para analizar.")
  return { ...primary, pages: uniquePages }
}
