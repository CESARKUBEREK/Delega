// Pantalla Hoy: fechas en la zona del espacio y títulos cortos de lo pendiente.
// npm test  →  node --test --experimental-strip-types tests/
import assert from "node:assert/strict"
import { test } from "node:test"
import { formatToday, formatWhen, greeting } from "../src/app/w/[workspaceId]/format.ts"
import { asPending, pendingKind, pendingTitle } from "../src/lib/pending.ts"

// Martes 27 de octubre de 2026, 10:10 en París (UTC+1).
const now = new Date("2026-10-27T09:10:00Z")

test("la fecha de hoy y el saludo usan la zona del espacio", () => {
  assert.equal(formatToday("Europe/Paris", now), "Martes 27 de octubre")
  assert.equal(greeting("Europe/Paris", now), "Buenos días")
  assert.equal(greeting("Europe/Paris", new Date("2026-10-27T16:00:00Z")), "Buenas tardes")
  assert.equal(greeting("Europe/Paris", new Date("2026-10-27T22:30:00Z")), "Buenas noches")
  // Una zona inválida no rompe la página.
  assert.equal(formatToday("Marte/Olimpo", now), "Martes 27 de octubre")
})

test("cuándo toca: hoy solo la hora, mañana con «Mañana», después con el día", () => {
  assert.equal(formatWhen("2026-10-27T16:00:00Z", "Europe/Paris", now), "17:00")
  assert.equal(formatWhen("2026-10-28T07:00:00Z", "Europe/Paris", now), "Mañana 8:00")
  assert.match(formatWhen("2026-11-02T07:00:00Z", "Europe/Paris", now), /^Lun 2 nov, 8:00$/)
})

test("lo pendiente se resume en una frase", () => {
  const email = asPending({ tool: "send_email", to_label: "Laura Gómez", address: "laura@example.com", subject: "Presupuesto", body: "Hola" })
  assert.equal(pendingTitle(email), "Enviar un correo a Laura Gómez")
  assert.equal(pendingKind(email), "email")

  const rows = asPending({ tool: "append_rows", file_name: "Gastos octubre", range: "A:D", values: [["27/10", "Leroy Merlin", 120]] })
  assert.equal(pendingTitle(rows), "Añadir 1 fila a «Gastos octubre»")
  assert.equal(pendingKind(rows), "sheet")

  const note = asPending({ tool: "crm_note", object: "deals", label: "Reforma cocina", text: "Llamar el jueves" })
  assert.equal(pendingTitle(note), "Añadir esta nota al negocio «Reforma cocina» en HubSpot")
  assert.equal(pendingKind(note), "other")
})
