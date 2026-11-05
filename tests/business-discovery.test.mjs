import test from "node:test"
import assert from "node:assert/strict"
import {
  combineWebsitePages,
  isSameOriginWebsiteUrl,
  parseWebsiteHtml,
  selectRelevantWebsiteLinks,
} from "../src/lib/business-discovery/website-parser.ts"

test("extrae título, descripción, encabezados, texto visible y enlaces", () => {
  const result = parseWebsiteHtml(
    '<html><head><title>Estudio Norte</title><meta name="description" content="Diseño y arquitectura"></head><body><script>no incluir</script><h1>Proyectos</h1><h2>Reformas integrales</h2><p>Atendemos empresas y particulares.</p><a href="/servicios">Servicios</a><a href="https://externo.example.org">Externo</a></body></html>',
    "https://example.com",
  )
  assert.equal(result.title, "Estudio Norte")
  assert.equal(result.description, "Diseño y arquitectura")
  assert.deepEqual(result.headings, ["Proyectos", "Reformas integrales"])
  assert.match(result.text, /Atendemos empresas y particulares/)
  assert.doesNotMatch(result.text, /no incluir/)
  assert.deepEqual(result.links, ["/servicios", "https://externo.example.org"])
  assert.doesNotThrow(() => parseWebsiteHtml("<p>&#99999999;</p>", "https://example.com"))
})

test("limita la cantidad de encabezados y texto extraído", () => {
  const headings = Array.from({ length: 20 }, (_, i) => `<h2>Sección ${i}</h2>`).join("")
  const result = parseWebsiteHtml(`<body>${headings}${"texto ".repeat(3000)}</body>`, "https://example.com")
  assert.equal(result.headings.length, 12)
  assert.ok(result.text.length <= 12_000)
  assert.ok(result.links.length <= 150)
})

test("selecciona como máximo dos páginas relevantes del mismo origen", () => {
  const selected = selectRelevantWebsiteLinks([
    "/blog/noticia",
    "/servicios",
    "/contacto",
    "https://otro-dominio.example/servicios",
    "mailto:hola@example.com",
    "/nosotros",
    "/servicios",
  ], "https://negocio.example/")
  assert.deepEqual(selected, ["https://negocio.example/servicios", "https://negocio.example/contacto"])
  assert.ok(selected.every((url) => isSameOriginWebsiteUrl("https://negocio.example/", url)))
  assert.equal(isSameOriginWebsiteUrl("https://negocio.example/", "https://otro-dominio.example/contacto"), false)
})

test("el snapshot elimina páginas duplicadas y nunca supera tres páginas", () => {
  const pages = Array.from({ length: 5 }, (_, index) => ({
    url: `https://negocio.example/pagina-${index}`,
    title: `Página ${index}`,
    description: null,
    headings: [],
    text: "Contenido",
  }))
  const snapshot = combineWebsitePages([pages[0], pages[1], pages[1], pages[2], pages[3]])
  assert.equal(snapshot.pages.length, 3)
  assert.equal(snapshot.url, pages[0].url)
  assert.deepEqual(snapshot.pages.map((page) => page.url), [pages[0].url, pages[1].url, pages[2].url])
})
