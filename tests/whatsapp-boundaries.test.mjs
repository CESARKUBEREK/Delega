import test from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { inboundText } from "../supabase/functions/_shared/whatsapp.ts"

// Fase 9b (W1): el núcleo no conoce a ningún proveedor de WhatsApp. Solo el
// registro y las funciones de alta de cada proveedor importan adaptadores, y
// solo los adaptadores hablan con la API de un proveedor.

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const FUNCTIONS = join(ROOT, "supabase/functions")

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : []
  })
}

const files = [...walk(FUNCTIONS), ...walk(join(ROOT, "src"))].map((p) => ({ path: relative(ROOT, p), text: readFileSync(p, "utf8") }))
const PROVIDERS_DIR = "supabase/functions/_shared/whatsapp/providers/"

// Quién puede importar un adaptador.
const MAY_IMPORT_PROVIDERS = new Set([
  "supabase/functions/_shared/whatsapp/registry.ts",
  // Alta de Twilio (cada proveedor tiene su propio flujo de conexión).
  "supabase/functions/whatsapp-connection/index.ts",
])

test("solo el registro y el alta importan adaptadores de WhatsApp", () => {
  const offenders = files
    .filter((f) => !f.path.startsWith(PROVIDERS_DIR) && !MAY_IMPORT_PROVIDERS.has(f.path) && !f.path.endsWith(".test.ts"))
    .filter((f) => /from\s+["'][^"']*whatsapp\/providers\//.test(f.text))
    .map((f) => f.path)
  assert.deepEqual(offenders, [])
})

test("solo los adaptadores llaman a la API de un proveedor", () => {
  const hosts = [/api\.twilio\.com/, /graph\.facebook\.com/, /api\.ycloud\.com/]
  const offenders = files
    .filter((f) => !f.path.startsWith(PROVIDERS_DIR))
    .filter((f) => f.path.startsWith("supabase/functions/"))
    .filter((f) => hosts.some((h) => h.test(f.text)) && /whatsapp/i.test(f.text))
    .map((f) => f.path)
  assert.deepEqual(offenders, [])
})

test("los webhooks siguen sin JWT y con firma del proveedor", () => {
  const deploy = readFileSync(join(ROOT, ".github/workflows/deploy-functions.yml"), "utf8")
  assert.match(deploy, /deploy telegram-webhook whatsapp-webhook [^\n]*\\\n\s*--no-verify-jwt/)
  const webhook = files.find((f) => f.path === "supabase/functions/whatsapp-webhook/index.ts").text
  assert.match(webhook, /if \(!\(await provider\.verifyWebhook\(raw, conn\)\)\) return new Response\("Forbidden", \{ status: 403 \}\)/)
  // Se verifica antes de interpretar o registrar nada.
  assert.ok(webhook.indexOf("verifyWebhook") < webhook.indexOf("parseWebhook"))
  assert.ok(webhook.indexOf("verifyWebhook") < webhook.indexOf("ingestEvents("))
})

test("el texto que entra en la bandeja es el mismo que antes de la capa", () => {
  assert.equal(inboundText({ text: "Hola", media: [] }), "Hola")
  assert.equal(inboundText({ text: "", media: [{ ref: "a" }] }), "[archivo adjunto]")
  assert.equal(inboundText({ text: "Mira", media: [{ ref: "a" }, { ref: "b" }] }), "Mira [2 archivos adjuntos]")
  assert.equal(inboundText({ text: "", media: [], location: { lat: -34.6, lng: -58.4 } }), "[ubicación -34.6, -58.4]")
  assert.equal(inboundText({ text: "  ", media: [] }), "")
})
