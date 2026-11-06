import test from "node:test"
import assert from "node:assert/strict"
import { analyzeBusinessProfile } from "../src/lib/business-discovery/business-profile.ts"

test("extrae indicios específicos y conserva evidencia con su página de origen", () => {
  const page = { url: "https://example.org", title: "Clínica Norte", description: "Ofrecemos tratamientos de fisioterapia a pacientes particulares.", headings: ["Fisioterapia y rehabilitación"], text: "Solicita una cita por teléfono. Atendemos pacientes particulares y empresas." }
  const second = { url: "https://example.org/servicios", title: "Servicios de fisioterapia", description: null, headings: ["Rehabilitación deportiva"], text: "Diseñamos planes de recuperación para deportistas y pacientes." }
  const profile = analyzeBusinessProfile({ ...page, pages: [page, second] })
  assert.match(profile.activity.value, /Clínica/)
  assert.match(profile.clients.value, /pacientes/)
  assert.match(profile.offer.value, /tratamientos/)
  assert.match(profile.acquisition.value, /cita/)
  assert.ok(profile.activity.evidence.length > 0)
  assert.equal(profile.clients.evidenceSources[0], page.url)
  assert.equal(profile.activity.confirmed, false)
})

test("no inventa datos cuando las páginas no aportan evidencia", () => {
  const page = { url: "https://example.org", title: null, description: null, headings: [], text: "Bienvenido." }
  const profile = analyzeBusinessProfile({ ...page, pages: [page] })
  for (const field of Object.values(profile)) {
    assert.equal(field.value, "")
    assert.equal(field.source, "not_found")
    assert.equal(field.evidence.length, 0)
    assert.equal(field.evidenceSources.length, 0)
    assert.equal(field.confirmed, false)
  }
})

test("no interpreta navegación genérica como actividad, oferta u operaciones", () => {
  const page = { url: "https://example.org", title: "Inicio", description: "Servicios y soluciones para tu empresa.", headings: ["Servicios", "Empresa", "Contacto"], text: "Inicio. Servicios. Contacto. Online. Software. Más información." }
  const profile = analyzeBusinessProfile({ ...page, pages: [page] })
  assert.equal(profile.activity.value, "")
  assert.equal(profile.offer.value, "")
  assert.equal(profile.operations.value, "")
  assert.equal(profile.tools.value, "")
})

test("reconoce una empresa de inteligencia de mercado descrita en inglés", () => {
  const page = {
    url: "https://argentinagateway.com",
    title: "Independent Market & Procurement Intelligence on Argentina",
    description: "Market intelligence, country risk analysis and procurement research for international companies.",
    headings: ["Supplier Intelligence", "Reports and Insights"],
    text: "We help importers, exporters and investors understand opportunities in Argentina. Our research and due diligence services support sourcing and procurement decisions. Contact us to discuss your requirements.",
  }
  const profile = analyzeBusinessProfile({ ...page, pages: [page] })
  assert.notEqual(profile.activity.value, "")
  assert.notEqual(profile.clients.value, "")
  assert.notEqual(profile.offer.value, "")
  assert.notEqual(profile.acquisition.value, "")
})

test("reconoce señales de negocio en francés", () => {
  const page = {
    url: "https://cabinet.example/",
    title: "Cabinet de conseil en stratégie",
    description: "Nous accompagnons les entreprises industrielles dans leur développement.",
    headings: ["Études de marché", "Stratégie export"],
    text: "Nos équipes réalisent des études de marché et des analyses sectorielles pour les entreprises et les investisseurs. Contactez-nous pour échanger sur votre projet.",
  }
  const profile = analyzeBusinessProfile({ ...page, pages: [page] })
  assert.notEqual(profile.activity.value, "")
  assert.notEqual(profile.clients.value, "")
  assert.notEqual(profile.offer.value, "")
  assert.notEqual(profile.acquisition.value, "")
})
