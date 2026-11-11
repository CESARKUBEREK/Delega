import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Precios con IA incluida, fase P2 (decisiones de Cesar, 11 nov).
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const pricing = read("src/lib/pricing.ts")
const catalog = read("supabase/migrations/20261111220000_plan_catalog_v2.sql")
const usageMigration = read("supabase/migrations/20261111210000_included_ai_usage.sql")
const precios = read("src/app/precios/page.tsx")
const hoy = read("src/app/w/[workspaceId]/page.tsx")
const diagnosis = read("src/lib/run-diagnosis.ts")
const router = read("supabase/functions/_shared/router/index.ts")

test("/precios y el catálogo de la base tienen los mismos precios", () => {
  for (const [usd, cents] of [["19", 1900], ["49", 4900], ["99", 9900]]) {
    assert.match(pricing, new RegExp(`price: "${usd} USD"`))
    assert.ok(catalog.includes(`${cents}::bigint, 'month'`), `${cents} mensual`)
    assert.ok(catalog.includes(`${cents * 10}::bigint, 'year'`), `${cents * 10} anual`)
    assert.match(pricing, new RegExp(`priceYear: "${Number(usd) * 10} USD/año \\(2 meses gratis\\)"`))
  }
})

test("/precios y los cupos de la base tienen las mismas tareas", () => {
  for (const tasks of [200, 600, 1500]) {
    assert.match(pricing, new RegExp(`monthlyTasks: ${tasks},`))
    assert.match(usageMigration, new RegExp(`"monthly_tasks":${tasks},`))
  }
})

test("los nombres cambian y los code no", () => {
  assert.match(catalog, /name = 'MarchaSolo Negocio'[\s\S]*where code = 'pro'/)
  assert.match(catalog, /name = 'MarchaSolo Equipo'[\s\S]*where code = 'business'/)
  assert.match(pricing, /id: "pro",\n\s+name: "Negocio"/)
  assert.match(pricing, /id: "business",\n\s+name: "Equipo"/)
})

test("WhatsApp solo desde Negocio", () => {
  const solo = pricing.slice(pricing.indexOf('id: "solo"'), pricing.indexOf('id: "pro"'))
  assert.doesNotMatch(solo, /WhatsApp/)
  assert.match(pricing, /"WhatsApp con tu número"/)
})

test("/precios dice que la IA va incluida y que la prueba dura 14 días", () => {
  assert.match(precios, /La IA ya va incluida/)
  assert.match(precios, /Pruébalo gratis 14 días/)
  assert.doesNotMatch(precios, /El consumo de IA se factura aparte|¿El precio del plan incluye el consumo de IA\?/)
})

test("Hoy enseña las tareas del mes y los avisos del 80 % y del 100 %", () => {
  assert.match(hoy, /Tareas este mes: \$\{included\.tasksUsed\} de \$\{included\.tasksAllowance\}/)
  assert.match(hoy, /Llegaste al límite de tareas de este mes/)
  assert.match(hoy, /Te quedan \$\{included\.tasksLeft\} tareas/)
})

test("el diagnóstico reconoce los mensajes de la IA incluida", () => {
  const ended = router.match(/INCLUDED_ENDED_MESSAGE =\n\s+"([^"]+)"/)[1]
  assert.match(ended, /límite de tareas de tu plan/)
  assert.match(diagnosis, /l\[ií\]mite de tareas de tu plan/)
  assert.match(diagnosis, /m\[aá\]ximo por ejecuci\[oó\]n de la IA incluida/)
})
