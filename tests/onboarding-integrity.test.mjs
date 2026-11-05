import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const onboarding = readFileSync(new URL("../src/lib/onboarding.ts", import.meta.url), "utf8")
const actions = readFileSync(new URL("../src/app/w/[workspaceId]/onboarding/actions.ts", import.meta.url), "utf8")
const client = readFileSync(new URL("../src/app/w/[workspaceId]/onboarding/onboarding-client.tsx", import.meta.url), "utf8")

test("el plan conserva todas las conexiones requeridas en orden estable", () => {
  assert.match(onboarding, /export function requiredConnections\(plan: FlowPlan\): OnboardingConnection\[\]/)
  assert.match(onboarding, /required\.push\("email"\)/)
  assert.match(onboarding, /required\.push\("calendar"\)/)
  assert.match(onboarding, /return requiredConnections\(plan\)\[0\] \?\? "none"/)
})

test("el servidor comprueba varias conexiones en una lectura y separa error de desconexión", () => {
  assert.match(actions, /export async function checkOnboardingConnections/)
  assert.match(actions, /const status = await setupStatus\(input\.workspaceId\)/)
  assert.match(actions, /catch \{\s*return \{ ok: false, error: "No se pudieron comprobar las conexiones\./)
})

test("el plan debe persistirse antes de avanzar y antes de completar", () => {
  assert.match(client, /const persistPlan = async/)
  assert.match(client, /if \(!savedFlowId\) return/)
  assert.match(client, /const savedFlowId = await persistPlan\(\)/)
  assert.match(client, /const result = await completeOnboarding\(workspaceId\)/)
})

test("la pantalla final reutiliza flowId y no crea otro borrador", () => {
  assert.match(client, /if \(!flowId\) \{\s*setError\("El borrador aún no está guardado/)
  assert.doesNotMatch(client, /saveFlowPlan\(\{ workspaceId, flowId: null, plan, fileIds: \[\] \}\)[\s\S]{0,100}router\.push/)
})

test("la numeración usa exactamente los pasos visibles", () => {
  assert.match(client, /visibleSteps\.map\(\(s, i\) =>/)
  assert.doesNotMatch(client, /ONBOARDING_STEPS\.map\(\(s, i\) =>/)
})

test("los errores de comprobación tienen estado propio y no conservan un conectado anterior", () => {
  assert.match(client, /"loading" \| "connected" \| "missing" \| "error"/)
  assert.match(client, /setStatus\("error"\)/)
  assert.match(client, /setStatus\(result\.connected \? "connected" : "missing"\)/)
})

test("la pantalla final lista y comprueba todas las conexiones del plan", () => {
  assert.match(client, /neededConnections\.map\(\(connection\) =>/)
  assert.match(client, /checkOnboardingConnections\(\{ workspaceId, connections: neededConnections \}\)/)
})
