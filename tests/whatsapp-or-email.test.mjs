import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Onboarding: si la automatización necesita WhatsApp, se ofrece empezar con el
// correo y sumar WhatsApp después (8 nov).
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")
const lib = read("src/lib/onboarding.ts")
const connect = read("src/components/onboarding/connect-step.tsx")
const client = read("src/app/w/[workspaceId]/onboarding/onboarding-client.tsx")

test("el cambio al correo toca disparador, conexiones y pasos de WhatsApp", () => {
  assert.match(lib, /export function planWithEmailInsteadOfWhatsapp/)
  assert.match(lib, /plan\.trigger\.type === "whatsapp_message"\s*\n\s*\? \{ type: "email_message"/)
  assert.match(lib, /c\.kind === "whatsapp" \? "email" : c\.kind/)
  assert.match(lib, /s\.connection === "whatsapp"\s*\n\s*\? \{ \.\.\.s, connection: "email"/)
  assert.match(lib, /WHATSAPP_LATER_NOTE/)
})

test("el paso Conectar ofrece el correo solo para WhatsApp", () => {
  assert.match(connect, /needed === "whatsapp" && onUseEmailInstead/)
  assert.match(connect, /Empezar con el correo/)
  assert.match(client, /onUseEmailInstead=\{needed === "whatsapp" \? useEmailInstead : undefined\}/)
  // Se guarda en el mismo borrador, no en uno nuevo.
  assert.match(client, /saveFlowPlan\(\{ workspaceId, flowId, plan: next, fileIds: \[\] \}\)/)
})
