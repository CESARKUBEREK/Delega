import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// IA incluida en los planes, fase P1 (decisión de Cesar, 11 nov).
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const router = read("supabase/functions/_shared/router/index.ts")
const llm = read("supabase/functions/_shared/llm.ts")
const agent = read("supabase/functions/_shared/agent.ts")
const trial = read("src/lib/trial.ts")
const migration = read("supabase/migrations/20261111210000_included_ai_usage.sql")

test("la IA incluida solo se usa con el interruptor encendido", () => {
  assert.match(router, /Deno\.env\.get\("INCLUDED_AI_ENABLED"\)\?\.trim\(\) !== "true"\) return null/)
})

test("la IA propia tiene prioridad sobre la incluida y sobre la prueba", () => {
  assert.match(router, /if \(!own\.length\) \{\n\s+const included = await routeIncluded\(admin, workspaceId, task\)/)
})

test("sin tareas o sin USD en el periodo, el router no sigue con la IA incluida", () => {
  assert.match(router, /usage\.usdLeft <= 0 \|\| \(countsAsTask\(task\) && usage\.tasksLeft <= 0\)/)
  assert.match(router, /return task === "agent" \|\| task === "draft_reply"/)
})

test("lo que paga MarchaSolo no cuenta en el gasto del cliente", () => {
  assert.match(llm, /return ai\.trial === true \|\| ai\.included === true/)
  assert.match(llm, /const cost = funded \? 0 : realCost/)
  assert.match(agent, /const cost = funded \? 0 : actualCost/)
})

test("cada ejecución cuenta 1 tarea en su primera llamada; clasificar no cuenta", () => {
  assert.match(agent, /p_units: firstCall \? 1 : 0/)
  assert.match(llm, /p_units: kind === "reply" \? 1 : 0/)
})

test("la prueba dura 14 días además del límite de 1 USD", () => {
  assert.match(migration, /alter column expires_at set default \(now\(\) \+ interval '14 days'\)/)
  assert.match(router, /new Date\(data\.expires_at as string\)\.getTime\(\) <= Date\.now\(\)\) return 0/)
  assert.match(trial, /const usdRemaining = expired \? 0 :/)
  assert.match(migration, /c\.used_usd < c\.allowance_usd and c\.expires_at > now\(\)/)
})

test("cupos del plan: 200, 600 y 1.500 tareas; tope de 10, 30 y 75 USD", () => {
  assert.match(migration, /\('solo',\s+'\{"monthly_tasks":200,\s+"period_usd_cap":10/)
  assert.match(migration, /\('pro',\s+'\{"monthly_tasks":600,\s+"period_usd_cap":30/)
  assert.match(migration, /\('business', '\{"monthly_tasks":1500, "period_usd_cap":75/)
})

test("las funciones de uso solo las ejecuta service_role", () => {
  for (const fn of ["usage_current(uuid)", "usage_consume(uuid, text, numeric, numeric)", "usage_period_roll()"]) {
    assert.ok(migration.includes(`revoke all on function public.${fn} from public, anon, authenticated`), fn)
    assert.ok(migration.includes(`grant execute on function public.${fn} to service_role`), fn)
  }
})
