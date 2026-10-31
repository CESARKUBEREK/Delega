// deno test -A _shared/inbox-rules.test.ts
import { deepStrictEqual as assertEquals } from "node:assert"
import { applyRules, businessDaysAgo, domainOf, type InboxRule } from "./inbox-rules.ts"

const CATS = ["Cliente", "Proveedor", "Administración", "Personal", "Publicidad", "Otros"]

Deno.test("boletines y avisos van a Publicidad sin IA", () => {
  assertEquals(applyRules({ address: "news@tienda.com", subject: "Novedades", automatic: false }, [], CATS)?.category, "Publicidad")
  assertEquals(applyRules({ address: "no-reply@banco.es", subject: "Aviso", automatic: false }, [], CATS)?.skipAi, true)
  assertEquals(applyRules({ address: "ana@empresa.com", subject: "Hola", automatic: true }, [], CATS)?.category, "Publicidad")
  assertEquals(applyRules({ address: "ana@empresa.com", subject: "Presupuesto reforma", automatic: false }, [], CATS), null)
})

Deno.test("facturas de remitentes de facturación van a Administración", () => {
  const r = applyRules({ address: "billing@stripe.com", subject: "Your invoice #123", automatic: false }, [], CATS)
  assertEquals(r?.category, "Administración")
})

Deno.test("las reglas de la persona mandan: remitente antes que dominio", () => {
  const rules: InboxRule[] = [
    { match_type: "domain", value: "inmo.com", category: "Proveedor" },
    { match_type: "sender", value: "laura@inmo.com", category: "Cliente" },
  ]
  assertEquals(applyRules({ address: "laura@inmo.com", subject: "x", automatic: false }, rules, CATS)?.category, "Cliente")
  assertEquals(applyRules({ address: "pepe@ventas.inmo.com", subject: "x", automatic: false }, rules, CATS)?.category, "Proveedor")
  // Una regla con una categoría que ya no existe no se aplica.
  assertEquals(applyRules({ address: "x@otro.com", subject: "x", automatic: false }, [{ match_type: "domain", value: "otro.com", category: "Vieja" }], CATS), null)
  // Una regla a una categoría normal no salta la IA (resumen, urgencia…).
  assertEquals(applyRules({ address: "laura@inmo.com", subject: "x", automatic: false }, rules, CATS)?.skipAi, false)
})

Deno.test("dominio y días laborables", () => {
  assertEquals(domainOf("Ana@Empresa.COM"), "empresa.com")
  assertEquals(domainOf("sin-arroba"), null)
  // Lunes 2 nov 2026 → 3 días laborables antes = miércoles 28 oct.
  assertEquals(businessDaysAgo(3, new Date("2026-11-02T10:00:00Z")).toISOString().slice(0, 10), "2026-10-28")
})
