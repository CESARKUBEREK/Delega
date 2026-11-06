import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const onboarding = readFileSync(new URL("../src/lib/onboarding.ts", import.meta.url), "utf8")
const actions = readFileSync(new URL("../src/app/w/[workspaceId]/onboarding/actions.ts", import.meta.url), "utf8")
const client = readFileSync(new URL("../src/app/w/[workspaceId]/onboarding/onboarding-client.tsx", import.meta.url), "utf8")

test("el plan mapea todas las capacidades y también el canal de entrada", () => {
  assert.match(onboarding, /export function requiredConnections\(plan: FlowPlan\): OnboardingConnection\[\]/)
  for (const kind of ["email", "whatsapp", "telegram", "spreadsheet", "documents", "drive", "calendar", "crm", "contacts", "properties", "accounting", "social", "database"]) {
    assert.ok(onboarding.includes(`${kind}: ["${kind}"]`), `falta el mapeo de ${kind}`)
  }
  assert.match(onboarding, /plan\.trigger\.type/)
  assert.match(onboarding, /return requiredConnections\(plan\)\[0\] \?\? "none"/)
})

test("el servidor comprueba los proveedores reales y limita los archivos a Google Drive", () => {
  assert.match(actions, /export async function checkOnboardingConnections/)
  assert.match(actions, /\.from\("integrations"\)[\s\S]*?\.select\("id, provider, status"\)/)
  for (const provider of ["imap", "google", "calendar", "whatsapp", "telegram", "hubspot", "contacts", "tokko", "xubio", "buffer", "supabase"]) {
    assert.ok(actions.includes(`"${provider}"`), `falta el proveedor ${provider}`)
  }
  assert.match(actions, /\.from\("integration_files"\)/)
  assert.match(actions, /\.in\("integration_id", googleIds\)/)
  assert.match(actions, /hasSpreadsheet/)
  assert.match(actions, /hasDocument/)
  assert.match(actions, /hasDriveFile/)
  assert.match(actions, /catch \{\s*return \{ ok: false, error: "No se pudieron comprobar las conexiones\./)
})

test("la demostración de aprobación es local y nunca ejecuta acciones externas", () => {
  assert.match(client, /<DemoApprovalCard plan=\{plan\} \/>/)
  const start = client.indexOf("function DemoApprovalCard")
  const end = client.indexOf("// Paso 3:", start)
  assert.ok(start >= 0 && end > start, "falta el componente de demostración")
  const demo = client.slice(start, end)
  assert.match(demo, /setDecision\("approved"\)/)
  assert.match(demo, /setDecision\("rejected"\)/)
  assert.match(demo, /Repetir ejemplo/)
  assert.match(demo, /no se ha ejecutado ninguna acción externa/i)
  assert.doesNotMatch(demo, /saveFlowPlan|fetch\(|\.from\(["']flow_runs/)
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
