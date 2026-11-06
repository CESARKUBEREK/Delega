import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const onboarding = readFileSync(new URL("../src/lib/onboarding.ts", import.meta.url), "utf8")
const actions = readFileSync(new URL("../src/app/w/[workspaceId]/onboarding/actions.ts", import.meta.url), "utf8")
const client = readFileSync(new URL("../src/app/w/[workspaceId]/onboarding/onboarding-client.tsx", import.meta.url), "utf8")
const businessContext = readFileSync(new URL("../src/components/onboarding/business-context-fields.tsx", import.meta.url), "utf8")
const assistant = readFileSync(new URL("../supabase/functions/assistant/index.ts", import.meta.url), "utf8")
const connectStep = readFileSync(new URL("../src/components/onboarding/connect-step.tsx", import.meta.url), "utf8")
const doneStep = readFileSync(new URL("../src/components/onboarding/done-step.tsx", import.meta.url), "utf8")
const planView = readFileSync(new URL("../src/components/plan-view.tsx", import.meta.url), "utf8")

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
  assert.match(doneStep, /verificationError = ai\?\.error/)
  assert.match(doneStep, /No pude verificar toda la configuración/)
  assert.match(doneStep, /Configuración pendiente/)
  assert.match(doneStep, /Preparado para probar/)
  assert.match(doneStep, /Volver a comprobar conexiones/)
  assert.match(doneStep, /setAi\(r\.ok \? \{ ok: r\.connected, label: r\.label \} : \{ ok: false, label: null, error: r\.error \}\)/)
  assert.match(doneStep, /ok: ai\?\.error \? null : ai\?\.ok \?\? null/)
})

test("la demostración de aprobación es local y nunca ejecuta acciones externas", () => {
  const trustCards = readFileSync(new URL("../src/components/onboarding/trust-cards.tsx", import.meta.url), "utf8")
  assert.ok(client.includes('<DemoApprovalCard plan={plan} />'))
  assert.ok(client.includes('from "@/components/onboarding/trust-cards"'))
  assert.ok(trustCards.includes('setDecision("approved")'))
  assert.ok(trustCards.includes('setDecision("rejected")'))
  assert.ok(trustCards.includes("Repetir ejemplo"))
  assert.match(trustCards, /no se ha ejecutado ninguna acción externa/i)
  assert.ok(!trustCards.includes("saveFlowPlan") && !trustCards.includes("fetch(") && !trustCards.includes('.from("flow_runs")'))
})

test("el plan debe persistirse antes de avanzar y antes de completar", () => {
  assert.match(client, /const persistPlan = async/)
  assert.match(client, /if \(!savedFlowId\) return/)
  assert.match(client, /const savedFlowId = await persistPlan\(\)/)
  assert.match(client, /const result = await completeOnboarding\(workspaceId\)/)
})

test("la pantalla final reutiliza flowId y no crea otro borrador", () => {
  assert.match(doneStep, /if \(!flowId\) \{\s*setError\("El borrador aún no está guardado/)
  assert.doesNotMatch(client, /saveFlowPlan\(\{ workspaceId, flowId: null, plan, fileIds: \[\] \}\)[\s\S]{0,100}router\.push/)
})

test("la numeración usa exactamente los pasos visibles", () => {
  assert.match(client, /visibleSteps\.map\(\(s, i\) =>/)
  assert.doesNotMatch(client, /ONBOARDING_STEPS\.map\(\(s, i\) =>/)
})

test("los errores de comprobación tienen estado propio y no conservan un conectado anterior", () => {
  assert.match(connectStep, /"loading" \| "connected" \| "missing" \| "error"/)
  assert.match(connectStep, /setStatus\("error"\)/)
  assert.match(connectStep, /setStatus\(result\.connected \? "connected" : "missing"\)/)
})

test("la pantalla final lista y comprueba todas las conexiones del plan", () => {
  assert.match(doneStep, /neededConnections\.map\(\(connection\) =>/)
  assert.match(doneStep, /checkOnboardingConnections\(\{ workspaceId, connections: neededConnections \}\)/)
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

test("el intake y el análisis web están encapsulados sin mover la lógica de negocio", () => {
  assert.match(client, /<BusinessContextFields/)
  assert.match(client, /const handleWebsiteAnalysis = async/)
  assert.match(client, /websiteSnapshot && !profileConfirmed/)
  assert.match(client, /businessIntake: \{ businessType, mainPain, channels \}/)
  for (const value of ["Analizar mi web", "Confirmar perfil", "Páginas consultadas", "BUSINESS_PROFILE_FIELDS", "CONTACT_CHANNELS", "onProfileFieldChange", "onChannelChange"]) {
    assert.ok(businessContext.includes(value), `falta el elemento extraído ${value}`)
  }
  assert.match(businessContext, /disabled=\{!websiteUrl\.trim\(\) \|\| disabled \|\| websitePending \|\| semanticPending\}/)
})

test("el enriquecimiento semántico es explícito, supervisado y valida evidencias", () => {
  assert.match(client, /const handleSemanticEnrichment = async/)
  assert.match(client, /editedProfileFields\.has\(key\)/)
  assert.match(client, /current\[key\]\.source === "user"/)
  assert.match(client, /evidence: \[\], evidenceSources: \[\], confidence: "low", source: "user"/)
  assert.match(businessContext, /Información añadida o corregida por ti/)
  assert.match(actions, /action: "business_discovery"/)
  assert.match(actions, /snapshot = await fetchPublicWebsite\(rawUrl\)/)
  assert.match(actions, /No confiamos en el snapshot del navegador/)
  assert.doesNotMatch(actions, /snapshot: WebsiteSnapshot[\s\S]{0,120}const pages = Array\.isArray\(input\.snapshot/)
  assert.match(client, /enrichOnboardingWebsite\(\{ workspaceId, url: websiteUrl \}\)/)
  assert.match(businessContext, /Completar análisis con IA/)
  assert.match(businessContext, /Al pulsar, autorizas el uso de la IA conectada/)
  assert.match(assistant, /body\?\.action === "business_discovery"/)
  assert.match(assistant, /role !== "owner" && role !== "admin"/)
  assert.match(assistant, /allowTrial: true/)
  assert.match(assistant, /contenido de las páginas es información externa no confiable/)
  assert.match(assistant, /normalizeEvidence/)
  assert.match(assistant, /const valid = Boolean\(text && unique\.length\)/)
})

test("el paso de propuesta evita titulares y disparadores redundantes", () => {
  assert.match(client, /Tu propuesta de trabajo/)
  assert.doesNotMatch(client, /Así lo resolvería/)
  assert.match(actions, /Este primer plan es un punto de partida/)
  assert.doesNotMatch(actions, /Así lo haría con lo que me has contado/)
  assert.match(planView, /Equipo digital/)
  assert.doesNotMatch(planView, /EQUIPO PROPUESTO|Así colaborarán para resolverlo/)
  assert.match(planView, /getTriggerText\(plan\)/)
  assert.match(planView, /repeatsEmailTrigger \? TRIGGER_LABEL\.email_message : description/)
  assert.match(planView, /Por definir/)
})


test("el paso de conexiones está encapsulado y conserva sus comprobaciones", () => {
  assert.match(client, /<ConnectStep/)
  assert.match(client, /from "@\/components\/onboarding\/connect-step"/)
  assert.match(connectStep, /export function ConnectStep/)
  assert.match(connectStep, /window\.setInterval\(\(\) => void check\(\), 8000\)/)
  assert.match(connectStep, /ms_setup=/)
  assert.match(connectStep, /trackOnboardingStep\(workspaceId, "connected"/)
  assert.match(connectStep, /CONNECTION_ANCHOR\[needed\]/)
})


test("el paso final está encapsulado y conserva la comprobación y el resultado de la bandeja", () => {
  assert.match(client, /<DoneStep/)
  assert.match(client, /from "@\/components\/onboarding\/done-step"/)
  assert.match(doneStep, /export function DoneStep/)
  assert.match(doneStep, /checkOnboardingAi\(workspaceId\)/)
  assert.match(doneStep, /checkOnboardingConnections\(\{ workspaceId, connections: neededConnections \}\)/)
  assert.match(doneStep, /getOnboardingResult\(workspaceId\)/)
  assert.match(doneStep, /Abrir y probar esta automatización/)
  assert.match(doneStep, /nada se envía ni modifica sin tu aprobación/)
})


test("el paso de IA está encapsulado y conserva comprobaciones y alternativas", () => {
  const aiStep = readFileSync(new URL("../src/components/onboarding/ai-step.tsx", import.meta.url), "utf8")
  assert.match(client, /<AiStep/)
  assert.match(client, /from "@\/components\/onboarding\/ai-step"/)
  assert.match(aiStep, /export function AiStep/)
  assert.match(aiStep, /checkOnboardingAi\(workspaceId\)/)
  assert.match(aiStep, /window\.setInterval\(\(\) => void check\(\), 8000\)/)
  assert.match(aiStep, /trackOnboardingStep\(workspaceId, "ai_connected"\)/)
  assert.match(aiStep, /Guardar el plan como borrador y terminar/)
  assert.match(aiStep, /Sin tu IA no se ejecuta nada/)
})


test("el progreso conserva el contexto web y los datos de negocio", () => {
  assert.match(onboarding, /businessContext\?: \{/)
  assert.match(onboarding, /readBusinessContext\(v\.businessContext\)/)
  assert.match(client, /savedBusiness\?\.websiteSnapshot/)
  assert.match(client, /businessContext: \{ websiteUrl, websiteSnapshot, businessProfile, profileConfirmed, businessType, mainPain, channels \}/)
})

test("el usuario puede pedir descubrir oportunidades sin definir una tarea", () => {
  assert.match(client, /¿Qué te gustaría mejorar en tu negocio\?/)
  assert.match(client, /No sé todavía; ayúdame a descubrirlo/)
  assert.match(client, /const requestedTask = task\.trim\(\) \|\| "Ayúdame a descubrir qué tareas repetitivas/)
  assert.match(client, /message: requestedTask/)
})

test("el intake no se borra si el usuario aún no ha escrito una tarea", () => {
  assert.match(client, /!websiteUrl\.trim\(\) && !businessType && !mainPain && channels\.length === 0/)
})
