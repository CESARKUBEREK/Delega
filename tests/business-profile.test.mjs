import test from "node:test"
import assert from "node:assert/strict"
import { analyzeBusinessProfile } from "../src/lib/business-discovery/business-profile.ts"

test("extrae indicios del negocio y conserva evidencia verificable", () => {
  const profile = analyzeBusinessProfile({
    url: "https://example.org",
    title: "Clínica Norte",
    description: "Atendemos pacientes y ofrecemos tratamientos de fisioterapia.",
    headings: ["Servicios de fisioterapia"],
    text: "Solicita una cita por teléfono. Horario de lunes a viernes.",
  })
  assert.match(profile.activity.value, /Clínica/)
  assert.match(profile.clients.value, /pacientes/)
  assert.match(profile.offer.value, /tratamientos/)
  assert.match(profile.acquisition.value, /cita/)
  assert.ok(profile.activity.evidence.length > 0)
  assert.equal(profile.activity.confirmed, false)
})

test("no inventa datos cuando la web no aporta evidencia", () => {
  const profile = analyzeBusinessProfile({
    url: "https://example.org",
    title: null,
    description: null,
    headings: [],
    text: "Bienvenido.",
  })
  for (const field of Object.values(profile)) {
    assert.equal(field.value, "")
    assert.equal(field.source, "not_found")
    assert.equal(field.confirmed, false)
  }
})
