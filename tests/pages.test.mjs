// Páginas vivas (fase 10-1): secciones, Markdown sin HTML, diff y cableado.
// npm test  →  node --test --experimental-strip-types tests/
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import {
  byteLength,
  diffLines,
  diffStats,
  MAX_PAGE_BYTES,
  pageSections,
  pageSlug,
  parseInline,
  parseMarkdown,
  replaceSection,
  safeHref,
} from "../supabase/functions/_shared/pages/core.ts"

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("el nombre de la página da un slug estable", () => {
  assert.equal(pageSlug("Informe – Av. Corrientes 1234"), "informe-av-corrientes-1234")
  assert.equal(pageSlug("Pendientes de pacientes"), "pendientes-de-pacientes")
  assert.equal(pageSlug("  Ñandú   ÁRBOL "), "nandu-arbol")
  assert.equal(pageSlug("¡¡!!"), "")
  assert.ok(pageSlug("x".repeat(200)).length <= 80)
  // Mismo nombre con otra puntuación → misma página.
  assert.equal(pageSlug("Informe - Corrientes 1234"), pageSlug("informe  corrientes 1234"))
})

test("sin sección se reemplaza la página entera", () => {
  assert.equal(replaceSection("## Viejo\nalgo", "", "## Nuevo\ntexto"), "## Nuevo\ntexto\n")
})

test("con sección se reemplaza solo esa, y las demás quedan igual", () => {
  const md = "# Informe\n\n## Resumen\n3 consultas\n\n## Consultas\n- Laura\n\n## Visitas\nNinguna\n"
  const out = replaceSection(md, "Consultas", "- Laura\n- Pedro")
  assert.equal(out, "# Informe\n\n## Resumen\n3 consultas\n\n## Consultas\n\n- Laura\n- Pedro\n\n## Visitas\nNinguna\n")
  assert.deepEqual(pageSections(out), ["Resumen", "Consultas", "Visitas"])
})

test("la sección se encuentra sin mirar mayúsculas ni tildes, y no se duplica su título", () => {
  const md = "## Próximos pasos\nLlamar\n"
  const out = replaceSection(md, "proximos pasos", "## Próximos pasos\nVisitar el jueves")
  assert.equal(out, "## proximos pasos\n\nVisitar el jueves\n")
  assert.deepEqual(pageSections(out), ["proximos pasos"])
})

test("una sección nueva se añade al final; en una página vacía, sola", () => {
  assert.equal(replaceSection("## Resumen\nok\n", "Visitas", "Dos"), "## Resumen\nok\n\n## Visitas\n\nDos\n")
  assert.equal(replaceSection("", "Resumen", "ok"), "## Resumen\n\nok\n")
})

test("un «##» dentro de un bloque de código no es una sección", () => {
  const md = "## A\n```\n## B\n```\n## C\nfin\n"
  assert.deepEqual(pageSections(md), ["A", "C"])
  assert.match(replaceSection(md, "A", "nuevo"), /^## A\n\nnuevo\n\n## C\nfin\n$/)
})

test("Markdown: bloques admitidos", () => {
  const blocks = parseMarkdown("# T\n\n## Resumen\nUna **línea** y otra\nseguida.\n\n- a\n- b\n\n1. uno\n2. dos\n\n> cita\n\n---\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```\ncódigo\n```")
  assert.deepEqual(blocks.map((b) => b.t), ["heading", "heading", "paragraph", "list", "list", "quote", "rule", "table", "code"])
  assert.equal(blocks[3].ordered, false)
  assert.equal(blocks[4].ordered, true)
  assert.equal(blocks[7].rows.length, 1)
  assert.equal(blocks[8].v, "código")
})

test("Markdown: el HTML es texto y solo se enlaza http(s) y mailto", () => {
  const p = parseMarkdown("<script>alert(1)</script> <img src=x onerror=alert(1)>")
  assert.deepEqual(p, [{ t: "paragraph", v: [{ t: "text", v: "<script>alert(1)</script> <img src=x onerror=alert(1)>" }] }])
  assert.deepEqual(parseInline("[clic](javascript:alert(1))"), [{ t: "text", v: "clic" }])
  assert.deepEqual(parseInline("[ficha](https://tokko.test/p/1)"), [{ t: "link", href: "https://tokko.test/p/1", v: [{ t: "text", v: "ficha" }] }])
  assert.equal(safeHref("data:text/html,hola"), null)
  assert.equal(safeHref("mailto:hola@marchasolo.com"), "mailto:hola@marchasolo.com")
})

test("diff por líneas", () => {
  const d = diffLines("a\nb\nc", "a\nc\nd")
  assert.deepEqual(d, [
    { op: "same", text: "a" },
    { op: "del", text: "b" },
    { op: "same", text: "c" },
    { op: "add", text: "d" },
  ])
  assert.deepEqual(diffStats(d), { added: 1, removed: 1 })
  assert.deepEqual(diffStats(diffLines("igual", "igual")), { added: 0, removed: 0 })
})

test("el tamaño se mide en bytes (50 KB como en la base)", () => {
  assert.equal(MAX_PAGE_BYTES, 51200)
  assert.equal(byteLength("ñ"), 2)
  assert.match(read("supabase/migrations/20261110120000_pages.sql"), /octet_length\(content_md\) <= 51200/)
})

test("el agente tiene update_page sin aprobación, solo en ejecuciones de administradores", () => {
  const agent = read("supabase/functions/_shared/agent.ts")
  assert.match(agent, /pagesActive: starterIsAdmin/)
  assert.match(agent, /if \(r\.pagesActive\) \{\s*tools\.push\(\s*fn\(\s*"update_page"/)
  assert.match(agent, /if \(call\.name === "update_page"\)/)
  // Se gestiona antes de las escrituras que esperan aprobación.
  assert.ok(agent.indexOf('if (call.name === "update_page")') < agent.indexOf("// Escrituras y envíos: se preparan y esperan aprobación."))
  assert.match(agent, /Nunca\s+pongas teléfonos ni correos de terceros en una página/)
})

test("la base: solo owners y admins, versiones automáticas y permisos de columna de verdad", () => {
  const sql = read("supabase/migrations/20261110120000_pages.sql")
  assert.match(sql, /using \(private\.has_role\(workspace_id, 'admin'\)\)/)
  assert.match(sql, /revoke all on public\.pages, public\.page_versions from anon, authenticated;/)
  assert.match(sql, /grant update \(title, content_md, sections, archived_at\) on public\.pages to authenticated;/)
  assert.match(sql, /order by id desc limit 50/)
})

test("la plantilla «Informe para el propietario» está en la vertical inmobiliaria y no pide aprobación", async () => {
  const { TEMPLATES, VERTICALS } = await import("../src/lib/templates.ts")
  const t = TEMPLATES.find((x) => x.id === "informe-propietario")
  assert.ok(t)
  assert.equal(t.category, "Inmobiliaria")
  assert.ok(t.plan.steps.every((s) => !s.requires_approval))
  assert.match(t.plan.steps.find((s) => s.kind === "generate").description, /nunca teléfonos ni correos/)
  assert.ok(VERTICALS.find((v) => v.id === "inmobiliarias").templates.includes("informe-propietario"))
})

test("la app pinta el Markdown sin insertar HTML", () => {
  const md = read("src/components/markdown.tsx")
  assert.doesNotMatch(md, /dangerouslySetInnerHTML/)
  assert.match(read("src/app/w/[workspaceId]/panel-nav.tsx"), /\{ slug: "paginas", label: "Páginas" \}/)
})
