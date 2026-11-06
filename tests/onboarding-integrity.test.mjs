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

test("el estado final distingue conexiones pendientes de errores de verificación", () => {
  assert.match(client, /verificationError = ai\?\.error/)
  assert.match(client, /No pude verificar toda la configuración/)
  assert.match(client, /Configuración pendiente/)
  assert.match(client, /Preparado para probar/)
  assert.match(client, /Volver a comprobar conexiones/)
  assert.match(client, /setAi\(r\.ok \? \{ ok: r\.connected, label: r\.label \} : \{ ok: false, label: null, error: r\.error \}\)/)
  assert.match(client, /ok: ai\?\.error \? null : ai\?\.ok \?\? null/)
})

test("la demostración de aprobación es local y nunca ejecuta acciones externas", () => {
  const trustCards = readFileSync(new URL("../src/components/onboarding/trust-cards.tsx", import.meta.url), "utf8")
  assert.match(client, /<DemoApprovalCard plan=\\{plan\\} \/>/)
  assert.match(client, /from "@\\/components\\/onboarding\\/trust-cards"/)
  assert.match(trustCards, /setDecision\\("approved"\\)/)
  assert.match(trustCards, /setDecision\\("rejected"\\)/)
  assert.match(trustCards, /Repetir ejemplo/)
  assert.match(trustCards, /no se ha ejecutado ninguna acción externa/i)
  assert.doesNotMatch(trustCards, /saveFlowPlan|fetch\\(|\\.from\\([\\\"']flow_runs/)
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

test("el intake estructurado del negocio se transmite y se valida antes de generar el plan", () => {
  for (const value of ["businessType", "mainPain", "channels", "customer_messages", "appointments", "sales_followup", "whatsapp", "instagram"]) {
    assert.ok(client.includes(value) || actions.includes(value), `falta el dato de intake ${value}`)
  }
  assert.match(client, /businessIntake: \{ businessType, mainPain, channels \}/)
  assert.match(actions, /Tipo de negocio: \\?\$\{businessType\}/)
  assert.match(actions, /Prioridad principal/)
  assert.match(actions, /Canales de contacto/)
  assert.match(actions, /hasOwnProperty\.call\(channelLabels, channel\)/)
  assert.match(actions, /adaptado al tipo de negocio, su prioridad y sus canales/)
})


test("el fallback local conserva el contexto estructurado del negocio sin inventar conexiones", () => {
  assert.match(actions, /localPlan\(message, input\.businessIntake\)/)
  const plans = readFileSync(new URL("../src/lib/onboarding-plans.ts", import.meta.url), "utf8")
  assert.match(plans, /businessIntake\?: \{ businessType\?: string; mainPain\?: string; channels\?: string\[\] \}/)
  assert.match(plans, /Contexto aportado/)
  assert.match(plans, /Canales indicados/)
  assert.match(plans, /if \(best\) return \{ version: 1, \.\.\.best\.plan, summary:/)
})
