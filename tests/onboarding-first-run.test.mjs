import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// «Listo» → «Probar ahora»: la primera ejecución sin salir del onboarding (8 nov).
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const firstRun = read("src/components/onboarding/first-run.tsx")
const done = read("src/components/onboarding/done-step.tsx")

test("lanza y sigue la ejecución con las acciones de siempre", () => {
  assert.match(firstRun, /startRun\(\{ workspaceId, flowId, fileIds: \[\], note: "" \}\)/)
  assert.match(firstRun, /continueRun\(runId\)/)
  assert.match(firstRun, /if \(phase\.kind !== "running" \|\| !phase\.runId\) return/)
})

test("nunca aprueba desde el onboarding: lleva a la pantalla de revisión", () => {
  assert.ok(!firstRun.includes("decideRun"))
  assert.match(firstRun, /Revisar y aprobar/)
  assert.match(firstRun, /\/ejecuciones\/\$\{runId\}/)
})

test("solo se prueba aquí si arranca a mano o programada y no pide archivos", () => {
  assert.match(done, /plan\.trigger\.type === "manual" \|\| plan\.trigger\.type === "schedule"/)
  assert.match(done, /c === "spreadsheet" \|\| c === "documents" \|\| c === "drive"/)
  assert.match(done, /<FirstRun workspaceId=\{workspaceId\} base=\{base\} flowId=\{flowId\}/)
  // El resto sigue con «Abrir y probar».
  assert.match(done, /Abrir y probar esta automatización/)
})
