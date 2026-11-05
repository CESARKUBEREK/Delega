import "server-only"

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { request as httpsRequest } from "node:https"
import { request as httpRequest } from "node:http"
import type { IncomingMessage, RequestOptions } from "node:http"
import { parseWebsiteHtml, type WebsiteSnapshot } from "./website-parser"

const MAX_BYTES = 1_000_000
const TIMEOUT_MS = 7_000
const MAX_REDIRECTS = 3

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b, c] = parts
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && (b === 0 || b === 168)) return false
  if (a === 192 && b === 0 && c === 2) return false
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false
  if (a === 203 && b === 0 && c === 113) return false
  return true
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPublicIpv4(address)
  if (version === 6) {
    // Fail closed for IPv6 until we validate against a complete maintained
    // special-purpose registry. Prefix checks alone miss reserved allocations.
    return false
  }
  return false
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

export async function fetchPublicWebsite(input: string): Promise<WebsiteSnapshot> {
  const trimmed = input.trim()
  const lowerInput = trimmed.toLowerCase()
  const normalizedInput = lowerInput.startsWith("http://") || lowerInput.startsWith("https://") ? trimmed : `https://${trimmed}`
  let current = validateUrl(normalizedInput)

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const records = await lookup(current.hostname, { all: true, verbatim: true })
    if (!records.length || records.some((record) => !isPublicAddress(record.address))) {
      throw new Error("No se puede analizar esta dirección porque no resuelve a una IP pública segura.")
    }

    const selected = records[0]
    const response = await requestPinned(current, selected.address, selected.family)
    if (response.location) {
      if (redirects === MAX_REDIRECTS) throw new Error("La web redirige demasiadas veces.")
      current = validateUrl(new URL(response.location, current).toString())
      continue
    }

    return parseWebsiteHtml(response.body, current.toString())
  }

  throw new Error("No se pudo analizar la web.")
}
