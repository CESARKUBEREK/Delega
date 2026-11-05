import test from "node:test"
import assert from "node:assert/strict"
import { analyzeBusinessProfile } from "../src/lib/business-discovery/business-profile.ts"

test("extrae indicios del negocio y conserva evidencia con su página de origen", () => {
  const profile = analyzeBusinessProfile({
    url: "https://example.org",
    title: "Clínica Norte",
    description: "Ofrecemos tratamientos de fisioterapia.",
    headings: ["Servicios de fisioterapia"],
    text: "Solicita una cita por teléfono. Horario de lunes a viernes.",
    pages: [
      {
        url: "https://example.org",
        title: "Clínica Norte",
        description: "Ofrecemos tratamientos de fisioterapia.",
        headings: ["Servicios de fisioterapia"],
        text: "Solicita una cita por teléfono. Horario de lunes a viernes.",
      },
      {
        url: "https://example.org/servicios",
        title: "Servicios",
        description: null,
        headings: ["Atención a pacientes"],
        text: "Atendemos pacientes particulares y empresas.",
      },
    ],
  })
  assert.match(profile.activity.value, /Clínica/)
  assert.match(profile.clients.value, /pacientes/)
  assert.match(profile.offer.value, /tratamientos/)
  assert.match(profile.acquisition.value, /cita/)
  assert.ok(profile.activity.evidence.length > 0)
  assert.equal(profile.clients.evidenceSources[0], "https://example.org/servicios")
  assert.equal(profile.activity.confirmed, false)
})

test("no inventa datos cuando las páginas no aportan evidencia", () => {
  const page = {
    url: "https://example.org",
    title: null,
    description: null,
    headings: [],
    text: "Bienvenido.",
  }
  const profile = analyzeBusinessProfile({ ...page, pages: [page] })
  for (const field of Object.values(profile)) {
    assert.equal(field.value, "")
    assert.equal(field.source, "not_found")
    assert.equal(field.evidence.length, 0)
    assert.equal(field.evidenceSources.length, 0)
    assert.equal(field.confirmed, false)
  }
})
