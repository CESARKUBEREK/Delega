import test from "node:test"
import assert from "node:assert/strict"
import { parseWebsiteHtml } from "../src/lib/business-discovery/website-parser.ts"

test("extrae Open Graph, idioma, canonical y keywords con atributos en distinto orden", () => {
  const html = `<html lang="es-ES"><head>
    <meta content="Descripción Open Graph" property="og:description">
    <meta property="og:title" content="Título social">
    <meta name="description" content="Descripción SEO">
    <meta content="Marca Norte" property="og:site_name">
    <meta name="keywords" content="consultoría, pymes, estrategia">
    <link href="/inicio" rel="canonical"><title>Título HTML</title>
    </head><body><h1>Consultoría para pymes</h1><script>no leer</script><p>Servicios profesionales.</p></body></html>`
  const page = parseWebsiteHtml(html, "https://example.org/")
  assert.equal(page.title, "Título social")
  assert.equal(page.description, "Descripción SEO")
  assert.equal(page.siteName, "Marca Norte")
  assert.equal(page.language, "es-ES")
  assert.equal(page.canonicalUrl, "https://example.org/inicio")
  assert.deepEqual(page.keywords, ["consultoría", "pymes", "estrategia"])
  assert.match(page.text, /Servicios profesionales/)
  assert.doesNotMatch(page.text, /no leer/)
})

test("no inventa metadatos ni acepta canonical con esquema no web", () => {
  const page = parseWebsiteHtml('<html><head><link rel="canonical" href="javascript:alert(1)"></head><body>Hola</body></html>', "https://example.org/")
  assert.equal(page.title, null)
  assert.equal(page.description, null)
  assert.equal(page.canonicalUrl, null)
  assert.deepEqual(page.keywords, [])
})
