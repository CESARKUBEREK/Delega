import test from "node:test"
import assert from "node:assert/strict"
import { resolveTrialProviders } from "../supabase/functions/_shared/trial-routing.ts"

test("uses Anthropic as primary and DeepSeek as an independent fallback", () => {
  const result = resolveTrialProviders(" anthropic-secret ", " deepseek-secret ")
  assert.equal(result.primary?.provider, "anthropic")
  assert.equal(result.primary?.apiKey, "anthropic-secret")
  assert.equal(result.fallback?.provider, "deepseek")
  assert.equal(result.fallback?.apiKey, "deepseek-secret")
  assert.equal(result.fallback?.trial, true)
})

test("keeps onboarding available with DeepSeek when Anthropic is not configured", () => {
  const result = resolveTrialProviders("", "deepseek-secret")
  assert.equal(result.primary?.provider, "deepseek")
  assert.equal(result.primary?.model, "deepseek-flash")
  assert.equal(result.fallback, null)
})

test("does not invent a provider or key when no funded trial secret exists", () => {
  assert.deepEqual(resolveTrialProviders(undefined, "  "), { primary: null, fallback: null })
})
