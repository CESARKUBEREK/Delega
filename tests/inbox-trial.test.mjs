import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// La bandeja se ordena y prepara respuestas con la prueba gratuita (8 nov).
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const llm = read("supabase/functions/_shared/llm.ts")
const classify = read("supabase/functions/_shared/inbox-classify.ts")
const prepare = read("supabase/functions/_shared/inbox-prepare.ts")
const reply = read("supabase/functions/inbox-reply/index.ts")
const migration = read("supabase/migrations/20261108010000_inbox_trial.sql")
const done = read("src/components/onboarding/done-step.tsx")

test("clasificar, preparar y redactar admiten la prueba gratuita", () => {
  assert.match(classify, /routeAi\(admin, workspaceId, "classify", \{ allowTrialRun: true \}\)/)
  assert.match(prepare, /planRun\(admin, workspaceId, \{ task: "draft_reply", allowTrialRun: true \}\)/)
  assert.match(reply, /routeAi\(admin, workspaceId, "draft_reply", \{ allowTrialRun: true \}\)/)
})

test("solo las propuestas gastan el cupo de propuestas; lo demás, el saldo en USD", () => {
  assert.match(llm, /extra\.task === "plan" \|\| extra\.task === "review"/)
  assert.match(llm, /rpc\("trial_add_cost", \{ p_workspace_id: extra\.workspaceId, p_cost: realCost \}\)/)
})

test("la cola de la bandeja incluye espacios con saldo de prueba", () => {
  assert.match(migration, /c\.used_usd < c\.allowance_usd/)
  assert.match(migration, /grant execute on function public\.inbox_workspaces_pending\(int\) to service_role/)
})

test("«Listo» enseña la bandeja ordenada también con la prueba", () => {
  assert.match(done, /isAdmin && aiAvailable && toolReady && neededConnections\.includes\("email"\)/)
  assert.match(done, /if \(!result\.ownAi && !result\.trialAi\)/)
})
