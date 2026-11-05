import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../src/lib/business-discovery/website-fetcher.ts", import.meta.url), "utf8")

test("business discovery: solo admite HTTP(S), dominios y puertos web estándar", () => {
  assert.match(source, /url\.protocol !== "https:" && url\.protocol !== "http:"/)
  assert.match(source, /url\.username \|\| url\.password/)
  assert.match(source, /isIP\(url\.hostname\)/)
  assert.match(source, /url\.port !== "80" && url\.port !== "443"/)
  assert.match(source, /host\.endsWith\("\.localhost"\)/)
})

test("business discovery: resuelve DNS y bloquea destinos IPv4 no públicos", () => {
  assert.match(source, /lookup\(hostname, \{ all: true, verbatim: true \}\)/)
  assert.match(source, /isPublicIpv4\(r\.address\)/)
  assert.match(source, /a === 10 \|\| a === 127/)
  assert.match(source, /a === 169 && b === 254/)
  assert.match(source, /a === 172 && b >= 16 && b <= 31/)
})

test("business discovery: fija el socket a la IP validada y vuelve a validar redirecciones", () => {
  assert.match(source, /lookup: \(_hostname, _options, callback\) => callback\(null, address\.address, address\.family\)/)
  assert.match(source, /current = normalizeUrl\(new URL\(result\.location, current\)\.toString\(\)\)/)
  assert.match(source, /MAX_REDIRECTS = 3/)
})

test("business discovery: limita tiempo, bytes, tipo de contenido y texto extraído", () => {
  assert.match(source, /TIMEOUT_MS = 8_000/)
  assert.match(source, /MAX_BYTES = 750_000/)
  assert.match(source, /content-type/)
  assert.match(source, /maxTextCharacters: 12_000/)
  assert.match(source, /<\(script\|style\|noscript\|svg\|template\|iframe\)/)
})
