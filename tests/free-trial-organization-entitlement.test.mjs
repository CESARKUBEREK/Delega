import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Prueba gratuita hasta 1 USD (decisión del 7 nov): se concede por fila de
// créditos (no por tipo de espacio) y se limita por gasto, no por número de
// ejecuciones.
const router = readFileSync(new URL("../supabase/functions/_shared/router/index.ts", import.meta.url), "utf8")
const agent = readFileSync(new URL("../supabase/functions/_shared/agent.ts", import.meta.url), "utf8")
const migration = readFileSync(new URL("../supabase/migrations/20261107100000_trial_usd_budget.sql", import.meta.url), "utf8")

test("el saldo de la prueba se lee de la fila de créditos, en USD", () => {
  const start = router.indexOf("export async function trialRemainingUsd")
  const block = router.slice(start, router.indexOf("\n}\n", start))
  assert.match(block, /workspace_trial_credits/)
  assert.match(block, /allowance_usd/)
  assert.match(block, /used_usd/)
  assert.match(block, /if \(!data\) return 0/)
  assert.doesNotMatch(block, /kind === ["']personal["']/)
})

test("la prueba solo se usa sin IA propia y con saldo", () => {
  const start = router.indexOf("if (opts.allowTrialRun)")
  const end = router.indexOf("\n  const conns = await connections", start)
  const block = router.slice(start, end)
  assert.match(block, /connections\(admin, workspaceId\)/)
  assert.match(block, /own\.length \? 0 : await trialRemainingUsd/)
  assert.match(block, /remaining > 0/)
})

test("cada tramo de una ejecución gratuita vuelve a comprobar el saldo", () => {
  const start = router.indexOf("export async function aiForRun")
  const end = router.indexOf("\nexport function parseRunRouting", start)
  const block = router.slice(start, end)
  assert.match(block, /TRIAL_OPENAI_API_KEY/)
  assert.match(block, /trialRemainingUsd\(admin, workspaceId\)\) <= 0\) return null/)
})

test("el presupuesto de una ejecución gratuita no supera el tope ni el saldo", () => {
  assert.match(router, /Math\.min\(TRIAL_RUN_CAP_USD, await trialRemainingUsd\(admin, workspaceId\)\)/)
  assert.match(router, /export const TRIAL_RUN_CAP_USD = 0\.25/)
})

test("el agente apunta el coste de cada llamada gratuita", () => {
  assert.match(agent, /rpc\("trial_add_cost", \{ p_workspace_id: run\.workspace_id, p_cost: actualCost \}\)/)
  assert.match(agent, /trialStopMessage/)
})

test("la reserva exige saldo y una ejecución del mismo espacio", () => {
  const fn = migration.slice(migration.indexOf("create or replace function public.trial_run_consume"), migration.indexOf("create or replace function public.trial_run_commit"))
  assert.match(fn, /t\.used_usd < t\.allowance_usd/)
  assert.match(fn, /public\.flow_runs/)
  assert.doesNotMatch(fn, /w\.kind\s*=\s*'personal'/)
  assert.match(migration, /allowance_usd numeric\(10,4\) not null default 1\.00/)
  assert.match(migration, /grant execute on function public\.trial_add_cost\(uuid, numeric\) to service_role/)
  assert.match(migration, /revoke all on function public\.trial_add_cost\(uuid, numeric\) from public, anon, authenticated/)
})
