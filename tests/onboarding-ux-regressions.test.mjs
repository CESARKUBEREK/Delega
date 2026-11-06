import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = (path) => readFileSync(new URL(path, root), "utf8")
const websiteField = read("src/components/onboarding/business-context-fields.tsx")
const websiteFetcher = read("src/lib/business-discovery/website-fetcher.ts")
const planView = read("src/components/plan-view.tsx")
const approvalDemo = read("src/components/onboarding/trust-cards.tsx")

test("el onboarding acepta dominios con o sin protocolo y con www", () => {
  assert.match(websiteField, /type="text"/)
  assert.match(websiteField, /inputMode="url"/)
  assert.match(websiteField, /marchasolo\.com, www\.marchasolo\.com o https:\/\/marchasolo\.com/)
  assert.match(websiteFetcher, /startsWith\("http:\/\/ "\)/) === false
  assert.match(websiteFetcher, /startsWith\("http:\/\/"\) \|\| lowerInput\.startsWith\("https:\/\/"\)/)
  assert.match(websiteFetcher, /\`https:\/\/\$\{trimmed\}\`/)
})

test("el plan animado no vuelve a dibujar los mismos pasos", () => {
  assert.match(planView, /Equipo digital/)
  assert.match(planView, /Los pasos aparecen una sola vez/)
  assert.doesNotMatch(planView, /plan-team-flow/)
  assert.equal((planView.match(/plan\.steps\.map\(/g) ?? []).length, 1)
})

test("la simulación muestra un resultado visible y permite reiniciarla", () => {
  assert.match(approvalDemo, /onClick=\{\(\) => setDecision\("approved"\)\}/)
  assert.match(approvalDemo, /onClick=\{\(\) => setDecision\("rejected"\)\}/)
  assert.match(approvalDemo, /APROBADO · SIMULACIÓN/)
  assert.match(approvalDemo, /RECHAZADO · SIMULACIÓN/)
  assert.match(approvalDemo, /role="status" aria-live="polite" data-decision=\{decision\}/)
  assert.match(approvalDemo, /Has aprobado la propuesta/)
  assert.match(approvalDemo, /Has rechazado la propuesta/)
  assert.match(approvalDemo, /Repetir ejemplo/)
  assert.match(approvalDemo, /no se ha ejecutado ninguna acción externa/i)
})
