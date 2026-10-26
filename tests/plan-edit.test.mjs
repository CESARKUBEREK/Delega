// Reglas del editor visual de flujos (src/lib/plan-edit.ts).
// npm test  →  node --test --experimental-strip-types tests/
import assert from "node:assert/strict"
import { test } from "node:test"
import { KIND_CONNECTIONS, needsApproval, normalizePlan, planChecks, STEP_KINDS } from "../src/lib/plan-edit.ts"

const step = (kind, connection, title = "Paso", description = "") => ({ kind, connection, title, description })
const base = (steps, trigger = "manual") => ({ name: "Prueba", summary: "", trigger: { type: trigger, description: "" }, steps })

test("escribir o enviar a otros siempre pide aprobación; avisarme a mí no", () => {
  assert.equal(needsApproval("write", "spreadsheet"), true)
  assert.equal(needsApproval("notify", "email"), true)
  assert.equal(needsApproval("notify", "telegram"), true)
  assert.equal(needsApproval("notify", "none"), false)
  assert.equal(needsApproval("read", "spreadsheet"), false)
})

test("normalizar: aprobación impuesta, ids en orden y conexiones deducidas", () => {
  const r = normalizePlan(base([step("read", "spreadsheet", "Leer cobros"), step("write", "documents", "Crear informe"), step("notify", "none", "Avisarme")]))
  assert.ok(r.ok)
  assert.deepEqual(r.plan.steps.map((s) => s.id), ["s1", "s2", "s3"])
  assert.deepEqual(r.plan.steps.map((s) => s.requires_approval), [false, true, false])
  assert.deepEqual(r.plan.connections.map((c) => c.kind), ["spreadsheet", "documents"])
  assert.equal(r.plan.version, 1)
  assert.deepEqual(r.plan.open_questions, [])
})

test("normalizar: lo que manda el navegador no puede quitar la aprobación ni colar tipos", () => {
  const r = normalizePlan(base([{ kind: "write", connection: "spreadsheet", title: "x", description: "", requires_approval: false }, step("borrar_todo", "email", "y")]))
  assert.ok(r.ok)
  assert.equal(r.plan.steps[0].requires_approval, true)
  assert.equal(r.plan.steps[1].kind, "transform")
  assert.ok(KIND_CONNECTIONS.transform.includes(r.plan.steps[1].connection))
})

test("normalizar: aplicación no válida para el tipo se corrige", () => {
  const r = normalizePlan(base([step("write", "email", "Escribir"), step("notify", "calendar", "Avisar")]))
  assert.ok(r.ok)
  assert.equal(r.plan.steps[0].connection, KIND_CONNECTIONS.write[0])
  assert.equal(r.plan.steps[1].connection, "none")
  assert.equal(r.plan.steps[1].requires_approval, false)
})

test("normalizar: rechaza sin nombre, sin pasos, pasos vacíos o demasiados", () => {
  assert.equal(normalizePlan({ ...base([step("read", "email")]), name: "  " }).ok, false)
  assert.equal(normalizePlan(base([])).ok, false)
  assert.equal(normalizePlan(base([step("read", "email", "", "")])).ok, false)
  assert.equal(normalizePlan(base(Array.from({ length: 21 }, () => step("read", "email")))).ok, false)
  assert.equal(normalizePlan(null).ok, false)
})

test("normalizar: recorta textos largos y disparadores desconocidos pasan a manual", () => {
  const r = normalizePlan({ ...base([step("read", "email", "t".repeat(500), "d".repeat(5000))]), trigger: { type: "webhook", description: "x" } })
  assert.ok(r.ok)
  assert.equal(r.plan.steps[0].title.length, 120)
  assert.equal(r.plan.steps[0].description.length, 600)
  assert.equal(r.plan.trigger.type, "manual")
})

test("normalizar: conserva el «para qué» de las conexiones anteriores", () => {
  const prev = normalizePlan(base([step("read", "crm", "Leer")]))
  assert.ok(prev.ok)
  prev.plan.connections[0].purpose = "Negocios abiertos"
  const r = normalizePlan(base([step("read", "crm", "Otro título")]), prev.plan)
  assert.ok(r.ok)
  assert.equal(r.plan.connections[0].purpose, "Negocios abiertos")
})

test("cada tipo de paso tiene al menos una aplicación válida", () => {
  for (const k of STEP_KINDS) assert.ok(KIND_CONNECTIONS[k].length > 0, k)
})

test("comprobaciones: integración no conectada, planilla sin elegir, contactos y Telegram", () => {
  const plan = base([step("read", "spreadsheet"), step("notify", "email"), step("notify", "telegram")], "schedule")
  const checks = planChecks(plan, { connected: new Set(["imap"]), fileKinds: [], contacts: 0 })
  assert.ok(checks.some((c) => c.includes("no está conectado")))
  assert.ok(checks.some((c) => c.includes("ninguna en «Archivos que usa»")))
  assert.ok(checks.some((c) => c.includes("Contactos autorizados")))
  assert.ok(checks.some((c) => c.includes("Telegram")))
  const ok = planChecks(base([step("read", "spreadsheet"), step("notify", "none")], "schedule"), { connected: new Set(["google"]), fileKinds: ["planilla"], contacts: 0 })
  assert.deepEqual(ok, [])
})
