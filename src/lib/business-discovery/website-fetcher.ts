import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"

const MAX_BYTES = 750_000
const TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3
const USER_AGENT = "MarchaSoloBusinessDiscovery/1.0 (+https://www.marchasolo.com)"
type PublicAddress = { address: string; family: number }

export type WebsiteSnapshot = {
  url: string
  finalUrl: string
  title: string | null
  description: string | null
  headings: string[]
  text: string
  fetchedAt: string
}

export class WebsiteFetchError extends Error {
  constructor(message: string, readonly code: "invalid_url" | "unsafe_host" | "unreachable" | "timeout" | "too_large" | "not_html" | "redirect_limit") {
    super(message)
    this.name = "WebsiteFetchError"
  }
}

function isPublicIpv4(address: string): boolean {
  const p = address.split(".").map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false
  const [a, b, c] = p
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 0 || b === 168)) return false
  if (a === 192 && b === 88 && c === 99) return false
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
  if (a === 203 && b === 0 && c === 113) return false
  if (a === 255) return false
  return true
}

function normalizeUrl(input: string): URL {
  if (typeof input !== "string" || input.length > 2_048) throw new WebsiteFetchError("Introduce una dirección web válida.", "invalid_url")
  let url: URL
  try { url = new URL(input.trim().includes("://") ? input.trim() : "https://" + input.trim()) }
  catch { throw new WebsiteFetchError("La dirección web no es válida.", "invalid_url") }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || !url.hostname || isIP(url.hostname)) {
    throw new WebsiteFetchError("La dirección web no es válida para este análisis.", "invalid_url")
  }
  if (url.port && ((url.protocol === "https:" && url.port !== "443") || (url.protocol === "http:" && url.port !== "80"))) throw new WebsiteFetchError("Solo se admiten los puertos web estándar para cada protocolo.", "invalid_url")
  const host = url.hostname.toLowerCase().replace(/\.$/, "")
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new WebsiteFetchError("No se puede analizar esa dirección.", "unsafe_host")
  }
  url.hostname = host
  url.hash = ""
  return url
}

async function resolvePublicIpv4(hostname: string): Promise<PublicAddress[]> {
  let records: PublicAddress[]
  try { records = await lookup(hostname, { all: true, verbatim: true }) as PublicAddress[] }
  catch { throw new WebsiteFetchError("No hemos podido localizar esa web. Comprueba la dirección.", "unreachable") }
  if (!records.length || records.some((r) => r.family === 4 && !isPublicIpv4(r.address))) {
    throw new WebsiteFetchError("La dirección apunta a una red no pública y no se puede analizar.", "unsafe_host")
  }
  const ipv4 = records.filter((r) => r.family === 4 && isPublicIpv4(r.address))
  if (!ipv4.length) throw new WebsiteFetchError("Esta web no ofrece una dirección IPv4 pública compatible.", "unsafe_host")
  return ipv4
}

function requestHtml(url: URL, address: PublicAddress): Promise<{ location: string | null; body: string }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest
    let settled = false
    const fail = (error: Error) => { if (!settled) { settled = true; clearTimeout(deadline); reject(error) } }
    const req = transport({
      protocol: url.protocol, hostname: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80),
      method: "GET", path: (url.pathname || "/") + url.search,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-encoding": "identity" },
      timeout: TIMEOUT_MS, servername: url.hostname,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, (response) => {
      const status = response.statusCode ?? 0
      const location = typeof response.headers.location === "string" ? response.headers.location : null
      if (status >= 300 && status < 400 && location) {
        response.resume()
        if (!settled) { settled = true; clearTimeout(deadline); resolve({ location, body: "" }) }
        return
      }
      if (status < 200 || status >= 300) { response.resume(); fail(new WebsiteFetchError("La web no ha permitido leer su página pública.", "unreachable")); return }
      const type = String(response.headers["content-type"] ?? "").toLowerCase()
      if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
        response.resume(); fail(new WebsiteFetchError("La dirección no parece ser una página web HTML.", "not_html")); return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > MAX_BYTES) { req.destroy(new WebsiteFetchError("La página es demasiado grande para analizarla.", "too_large")); return }
        chunks.push(chunk)
      })
      response.on("end", () => { if (!settled) { settled = true; clearTimeout(deadline); resolve({ location: null, body: Buffer.concat(chunks).toString("utf8") }) } })
      response.on("error", fail)
    })
    const deadline = setTimeout(() => req.destroy(new WebsiteFetchError("La web ha tardado demasiado en responder.", "timeout")), TIMEOUT_MS)
    req.on("timeout", () => req.destroy(new WebsiteFetchError("La web ha tardado demasiado en responder.", "timeout")))
    req.on("error", fail)
    req.end()
  })
}

function decodeEntities(value: string): string {
  return value.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
}

function cleanText(html: string): string {
  return decodeEntities(html.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/(p|div|section|article|h[1-6]|li|br|tr|header|footer|nav)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")).replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12_000)
}

function metaContent(html: string, key: string): string | null {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = tag[0].match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    const value = tag[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]
    if (name === key.toLowerCase() && value) return decodeEntities(value).trim().slice(0, 500)
  }
  return null
}

function extractSnapshot(html: string, requestedUrl: string, finalUrl: string): WebsiteSnapshot {
  const rawTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]
  const headings = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]\s*>/gi)].slice(0, 12)
    .map((m) => cleanText(m[1]).slice(0, 180)).filter(Boolean)
  return { url: requestedUrl, finalUrl, title: rawTitle ? cleanText(rawTitle).slice(0, 240) : null,
    description: metaContent(html, "description") ?? metaContent(html, "og:description"), headings,
    text: cleanText(html), fetchedAt: new Date().toISOString() }
}

/** Homepage only. Revalidates redirects and pins each socket to a checked public IPv4 address. */
export async function fetchPublicWebsite(input: string): Promise<WebsiteSnapshot> {
  const requested = normalizeUrl(input)
  let current = requested
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const addresses = await resolvePublicIpv4(current.hostname)
    const result = await requestHtml(current, addresses[0])
    if (result.location) {
      if (redirect === MAX_REDIRECTS) throw new WebsiteFetchError("La web redirige demasiadas veces.", "redirect_limit")
      try { current = normalizeUrl(new URL(result.location, current).toString()) }
      catch (error) { if (error instanceof WebsiteFetchError) throw error; throw new WebsiteFetchError("La redirección no es válida.", "invalid_url") }
      continue
    }
    return extractSnapshot(result.body, requested.toString(), current.toString())
  }
  throw new WebsiteFetchError("No se ha podido completar el análisis.", "unreachable")
}

export const websiteDiscoveryLimits = { maxBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS, maxRedirects: MAX_REDIRECTS, maxTextCharacters: 12_000 } as const
