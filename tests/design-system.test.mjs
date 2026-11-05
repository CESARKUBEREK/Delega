// Regresiones del sistema de diseño compartido (src/app/globals.css).
// npm test -> node --test --experimental-strip-types tests/*.test.mjs
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
const ui = readFileSync(new URL("../src/components/ui.tsx", import.meta.url), "utf8")


function rule(selector) {
  const escaped = selector.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&")
  const match = css.match(new RegExp("(?:^|\\n)\\s*" + escaped + "\\s*\\{([^}]*)\\}"))
  assert.ok(match, "no se encontró la regla CSS " + selector)
  return match[1]
}

test("los tokens base de marca y estructura siguen definidos", () => {
  const root = css.match(/:root\s*\{([^}]*)\}/)
  assert.ok(root, "falta el bloque :root")
  for (const token of [
    "--paper", "--sheet", "--ink", "--graphite", "--turquesa", "--link",
    "--space-4", "--radius-md", "--border-subtle",
  ]) {
    assert.match(root[1], new RegExp("(?:^|\\s)" + token.replaceAll("-", "\\-") + "\\s*:"), "falta " + token)
  }
})

test("los botones compartidos conservan un foco visible", () => {
  const focus = rule(".ms-button:focus-visible")
  assert.match(focus, /outline\s*:\s*3px\s+solid\s+var\(--state-focus\)/)
  assert.match(focus, /outline-offset\s*:\s*3px/)
})

test("el campo de búsqueda compartido muestra foco en su contenedor", () => {
  const focus = rule(".ms-search-input:focus-within")
  assert.match(focus, /border-color\s*:\s*var\(--turquesa\)/)
  assert.match(focus, /outline\s*:\s*2px\s+solid\s+var\(--turquesa\)/)
  assert.match(focus, /outline-offset\s*:\s*2px/)
})

test("la interfaz respeta la preferencia de movimiento reducido", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
})


test("los encabezados y las tarjetas usan sus hooks de descripción correspondientes", () => {
  assert.ok(ui.includes('<h1 className="ms-page-header-title">{title}</h1>'))
  assert.ok(ui.includes('<p className="ms-page-header-description">{description}</p>'))
  assert.ok(ui.includes('<h2 className="ms-panel-card-title">{title}</h2>'))
  assert.ok(ui.includes('<p className="ms-panel-card-description">{description}</p>'))
  assert.ok(css.includes(".ms-page-header-description, .ms-panel-card-description {"))
})
