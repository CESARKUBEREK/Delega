export type WebsiteSnapshot = {
  url: string
  title: string | null
  description: string | null
  headings: string[]
  text: string
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

export function parseWebsiteHtml(html: string, url: string): WebsiteSnapshot {
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

  return {
    url,
    title: title || null,
    description: description || null,
    headings,
    text,
  }
}
