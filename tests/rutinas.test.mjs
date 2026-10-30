// Rutinas y plantillas (src/lib/templates.ts): coherencia con las reglas del editor.
import assert from "node:assert/strict"
import { test } from "node:test"
import { KIND_CONNECTIONS, needsApproval } from "../src/lib/plan-edit.ts"
import { findTemplate, ROUTINES, SECTOR_TEMPLATES, TEMPLATES } from "../src/lib/templates.ts"

test("hay 10 rutinas numeradas del 1 al 10", () => {
  assert.deepEqual(ROUTINES.map((r) => r.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test("cada plantilla está en una sola rutina (o en su sector) y todas existen", () => {
  const placed = [...ROUTINES.flatMap((r) => r.templates), ...SECTOR_TEMPLATES.flatMap((s) => s.templates)]
  assert.equal(new Set(placed).size, placed.length, "plantilla repetida")
  for (const id of placed) assert.ok(findTemplate(id), `no existe ${id}`)
  assert.deepEqual(TEMPLATES.map((t) => t.id).filter((id) => !placed.includes(id)), [])
})

test("cada paso usa una aplicación permitida y pide aprobación cuando debe", () => {
  for (const t of TEMPLATES) {
    for (const s of t.plan.steps) {
      assert.ok(KIND_CONNECTIONS[s.kind].includes(s.connection), `${t.id}: ${s.kind} con ${s.connection}`)
      assert.equal(s.requires_approval, needsApproval(s.kind, s.connection), `${t.id}: «${s.title}»`)
    }
  }
})

test("las rutinas sin plantilla llevan a otra pantalla", () => {
  for (const r of ROUTINES) assert.ok(r.templates.length || r.link, r.id)
})
