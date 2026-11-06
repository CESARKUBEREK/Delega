import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const router = readFileSync(new URL("../supabase/functions/_shared/router/index.ts", import.meta.url), "utf8")
const migration = readFileSync(new URL("../supabase/migrations/20261106190000_trial_organization_entitlements.sql", import.meta.url), "utf8")

test("free execution is granted by an explicit credit row, not by workspace kind", () => {
  const start = router.indexOf("if (opts.allowTrialRun)")
  const end = router.indexOf("\n  const conns = await connections", start)
  const block = router.slice(start, end)
  assert.match(block, /workspace_trial_credits/)
  assert.match(block, /used_runs.*allowance_runs/s)
  assert.match(block, /used_tokens.*allowance_tokens/s)
  assert.doesNotMatch(block, /kind === ["']personal["']/)
})

test("trial-funded agent checks remaining tokens before every continuation", () => {
  const start = router.indexOf("export async function aiForRun")
  const end = router.indexOf("\nexport function parseRunRouting", start)
  const block = router.slice(start, end)
  assert.match(block, /TRIAL_OPENAI_API_KEY/)
  assert.match(block, /workspace_trial_credits/)
  assert.match(block, /used_tokens.*allowance_tokens/s)
  assert.match(block, /return null/)
})

test("database reservation accepts explicitly funded organization workspaces and requires token budget", () => {
  const fn = migration.slice(migration.indexOf("create or replace function public.trial_run_consume"))
  assert.match(fn, /t\.used_runs < t\.allowance_runs/)
  assert.match(fn, /t\.used_tokens < t\.allowance_tokens/)
  assert.match(fn, /reserved_run_id is null/)
  assert.match(fn, /public\.flow_runs/)
  assert.doesNotMatch(fn, /w\.kind\s*=\s*'personal'/)
})
