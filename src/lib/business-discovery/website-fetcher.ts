import "server-only"

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { request as httpsRequest } from "node:https"
import { request as httpRequest } from "node:http"
import type { IncomingMessage, RequestOptions } from "node:http"
import { isPublicAddress } from "./ip-address"
import {
  combineWebsitePages,
  isSameOriginWebsiteUrl,
  parseWebsiteHtml,
  selectRelevantWebsiteLinks,
  type ParsedWebsitePage,
  type WebsiteSnapshot,
} from "./website-parser"

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 7_000
const MAX_REDIRECTS = 3

// Node's getaddrinfo can fail transiently when the runtime is under load.
// Retry only temporary resolver errors; never weaken the public-IP checks.
async function lookupWithRetry(hostname: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await lookup(hostname, { all: true, verbatim: true })
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as NodeJS.ErrnoException).code)
        : ""
      if (code !== "EBUSY" && code !== "EAI_AGAIN") throw error
      if (attempt === 2) {
        throw new Error("No hemos podido consultar el DNS de esta web. Inténtalo de nuevo dentro de unos segundos o continúa sin analizarla.")
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }
  throw new Error("No se pudo resolver el dominio.")
}

function validateUrl(input: string): URL {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error("Introduce una dirección web válida, por ejemplo https://tuempresa.com.")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Solo se admiten webs públicas HTTP o HTTPS.")
  if (url.username || url.password || (url.port && url.port !== (url.protocol === "https:" ? "443" : "80"))) {
    throw new Error("La dirección web contiene datos o un puerto no admitidos.")
  }
  if (["localhost", "local", "internal", "test", "example", "invalid", "onion"].some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`)) || isIP(url.hostname)) {
    throw new Error("La dirección debe pertenecer a un dominio público.")
  }
  url.hash = ""
  return url
}

async function requestPinned(url: URL, address: string, family: number): Promise<{ status: number; location: string | null; contentType: string; body: string }> {
  return new Promise((resolve, reject) => {
    const secure = url.protocol === "https:"
    const requestFn = secure ? httpsRequest : httpRequest
    const options: RequestOptions & { servername?: string } = {
      protocol: url.protocol,
      hostname: address,
      family,
      port: url.port || (secure ? 443 : 80),
      method: "GET",
      path: `${url.pathname || "/"}${url.search}`,
      servername: secure ? url.hostname : undefined,
      headers: {
        Host: url.host,
        "User-Agent": "MarchaSoloBusinessDiscovery/1.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "identity",
        Connection: "close",
      },
    }

    const req = requestFn(options, (res: IncomingMessage) => {
      const status = res.statusCode ?? 0
      const location = typeof res.headers.location === "string" ? res.headers.location : null
      const contentType = String(res.headers["content-type"] ?? "")
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.destroy()
        resolve({ status, location, contentType, body: "" })
        return
      }
      if (status < 200 || status >= 300) {
        res.resume()
        reject(new Error("La web no está disponible para su análisis."))
        return
      }
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        res.resume()
        reject(new Error("La dirección no parece ser una página web HTML."))
        return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > MAX_BYTES) {
          req.destroy(new Error("La página supera el tamaño permitido."))
          return
        }
        chunks.push(chunk)
      })
      res.on("end", () => resolve({ status, location: null, contentType, body: Buffer.concat(chunks).toString("utf8") }))
    })
    const totalTimeout = setTimeout(() => req.destroy(new Error("La web tardó demasiado en responder.")), TIMEOUT_MS)
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error("La web tardó demasiado en responder.")))
    req.on("error", (error) => { clearTimeout(totalTimeout); reject(error) })
    req.on("close", () => clearTimeout(totalTimeout))
    req.end()
  })
}

async function renderWithBrowserless(url: URL): Promise<ParsedWebsitePage | null> {
  const token = process.env.BROWSERLESS_API_TOKEN
  if (!token) return null

  const endpoint = new URL("https://production-ams.browserless.io/chromium/content")
  endpoint.searchParams.set("token", token)
  // Restrict browser navigation to the exact hostname supplied by the user.
  endpoint.searchParams.set("allowedDomains", JSON.stringify([url.hostname]))

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/html" },
      body: JSON.stringify({
        url: url.toString(),
        gotoOptions: { waitUntil: "domcontentloaded", timeout: 10_000 },
        waitForTimeout: 900,
        rejectResourceTypes: ["image", "media", "font", "websocket"],
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })
  } catch {
    return null
  }
  if (!response.ok || !response.body) return null

  const renderedUrlHeader = response.headers.get("x-response-url")
  let renderedUrl: URL
  try {
    renderedUrl = new URL(renderedUrlHeader || url.toString())
  } catch {
    return null
  }
  if (renderedUrl.origin !== url.origin || renderedUrl.username || renderedUrl.password) return null

  const siteStatus = Number(response.headers.get("x-response-code") || "200")
  if (siteStatus < 200 || siteStatus >= 300) return null

  const records = await lookupWithRetry(renderedUrl.hostname)
  if (!records.length || records.some((record) => !isPublicAddress(record.address))) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  }
  const html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8")
  const page = parseWebsiteHtml(html, renderedUrl.toString())
  return page.contentQuality === "usable" ? { ...page, contentSource: "rendered_html" } : null
}

async function fetchSinglePublicPage(input: string, expectedOrigin?: string, blockedUrls: Set<string> = new Set()): Promise<ParsedWebsitePage> {
  const trimmed = input.trim()
  const lowerInput = trimmed.toLowerCase()
  const normalizedInput = lowerInput.startsWith("http://") || lowerInput.startsWith("https://") ? trimmed : `https://${trimmed}`
  let current = validateUrl(normalizedInput)

  if (expectedOrigin && current.origin !== expectedOrigin) {
    throw new Error("Solo se pueden analizar páginas del mismo dominio.")
  }
  if (blockedUrls.has(current.toString())) throw new Error("La página ya se ha analizado.")

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const records = await lookupWithRetry(current.hostname)
    if (!records.length || records.some((record) => !isPublicAddress(record.address))) {
      throw new Error("No se puede analizar esta dirección porque no resuelve a una IP pública segura.")
    }

    const selected = records[0]
    const response = await requestPinned(current, selected.address, selected.family)
    if (response.location) {
      if (redirects === MAX_REDIRECTS) throw new Error("La web redirige demasiadas veces.")
      const next = validateUrl(new URL(response.location, current).toString())
      if (expectedOrigin && !isSameOriginWebsiteUrl(expectedOrigin, next.toString())) {
        throw new Error("La página intenta redirigir fuera del dominio del negocio.")
      }
      if (blockedUrls.has(next.toString())) throw new Error("La redirección apunta a una página ya analizada.")
      current = next
      continue
    }

    const parsed = parseWebsiteHtml(response.body, current.toString())
    if (parsed.contentQuality === "javascript_shell" && process.env.BROWSERLESS_API_TOKEN) {
      const rendered = await renderWithBrowserless(current)
      if (rendered) return rendered
    }
    return parsed
  }

  throw new Error("No se pudo analizar la web.")
}

export async function fetchPublicWebsite(input: string): Promise<WebsiteSnapshot> {
  const primary = await fetchSinglePublicPage(input)
  const primaryOrigin = new URL(primary.url).origin
  const candidates = selectRelevantWebsiteLinks(primary.links, primary.url, 2)
  const blockedUrls = new Set([primary.url])
  const secondary = await Promise.all(candidates.map(async (url) => {
    try {
      const page = await fetchSinglePublicPage(url, primaryOrigin, blockedUrls)
      blockedUrls.add(page.url)
      return page
    } catch {
      // El análisis principal sigue siendo útil aunque una página secundaria falle.
      return null
    }
  }))

  const pages = [primary, ...secondary.filter((page): page is ParsedWebsitePage => page !== null)]
    .map(({ links: _links, ...page }) => page)

  return combineWebsitePages(pages)
}
