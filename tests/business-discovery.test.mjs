import test from "node:test"
import assert from "node:assert/strict"
import { parseWebsiteHtml } from "../src/lib/business-discovery/website-parser.ts"

test("extrae título, descripción, encabezados y texto visible", () => {
  const result = parseWebsiteHtml(
    '<html><head><title>Estudio Norte</title><meta name="description" content="Diseño y arquitectura"></head><body><script>no incluir</script><h1>Proyectos</h1><h2>Reformas integrales</h2><p>Atendemos empresas y particulares.</p></body></html>',
    "https://example.com",
  )
  assert.equal(result.title, "Estudio Norte")
  assert.equal(result.description, "Diseño y arquitectura")
  assert.deepEqual(result.headings, ["Proyectos", "Reformas integrales"])
  assert.match(result.text, /Atendemos empresas y particulares/)
  assert.doesNotMatch(result.text, /no incluir/)
  assert.doesNotThrow(() => parseWebsiteHtml("<p>&#99999999;</p>", "https://example.com"))
})

test("limita la cantidad de encabezados y texto extraído", () => {
  const headings = Array.from({ length: 20 }, (_, i) => `<h2>Sección ${i}</h2>`).join("")
  const result = parseWebsiteHtml(`<body>${headings}${"texto ".repeat(3000)}</body>`, "https://example.com")
  assert.equal(result.headings.length, 12)
  assert.ok(result.text.length <= 12_000)
})
