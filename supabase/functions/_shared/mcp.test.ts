// deno test -A _shared/mcp.test.ts
// Servidor MCP (fase 11-1): permisos, autenticación y borradores.
import { deepStrictEqual as assertEquals, ok as assert, throws } from "node:assert"
import { API_KEY_RE, bearer, buildPending, keyInUrl, McpToolError, searchTerm, sha256Hex, toolScope, toolsFor, TOOLS } from "./mcp.ts"

Deno.test("cada permiso enseña solo sus herramientas y nunca hay una de enviar", () => {
  assertEquals(toolsFor(["read"]).map((t) => t.name), ["get_today", "list_threads", "get_thread", "search_threads", "list_templates"])
  assertEquals(toolsFor(["read", "organize"]).length, 7)
  assertEquals(toolsFor(["read", "organize", "drafts"]).length, 8)
  assert(!TOOLS.some((t) => /send|enviar/.test(t.name)))
  assertEquals(toolScope("draft_reply"), "drafts")
  assertEquals(toolScope("send_email"), null)
})

Deno.test("todas las herramientas llevan anotaciones (directorio de Claude)", () => {
  for (const t of TOOLS) {
    assert(typeof t.annotations.readOnlyHint === "boolean", t.name)
    assert(typeof t.annotations.destructiveHint === "boolean", t.name)
    assertEquals(t.annotations.readOnlyHint, t.scope === "read")
    assert(!("scope" in toolsFor(["read", "organize", "drafts"]).find((x) => x.name === t.name)!))
  }
})

Deno.test("la clave va en la cabecera, nunca en la URL", () => {
  const key = `ms_live_${"a1".repeat(24)}`
  assert(API_KEY_RE.test(key))
  assert(!API_KEY_RE.test(`msv_${"a".repeat(48)}`))
  assertEquals(bearer(new Request("https://x", { headers: { Authorization: `Bearer ${key}` } })), key)
  assertEquals(bearer(new Request("https://x", { headers: { Authorization: key } })), "")
  assert(keyInUrl(new URL(`https://www.marchasolo.com/mcp?k=${key}`)))
  assert(!keyInUrl(new URL("https://www.marchasolo.com/mcp")))
})

Deno.test("sha256 en hex, igual que extensions.digest en la base", async () => {
  assertEquals(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
})

Deno.test("la búsqueda no deja pasar caracteres de los filtros de PostgREST", () => {
  assertEquals(searchTerm("Corrientes 1234, (piso 3)"), "Corrientes 1234 piso 3")
  assertEquals(searchTerm("50%_off*"), "50 off")
  throws(() => searchTerm("a"), McpToolError)
})

const base = { id: "8f6e1c2a-1111-4222-8333-944455556666", subject: "Visita", contact_name: "Ana", contact_address: "ana@example.com" }

Deno.test("borrador de correo: en el mismo hilo, con «Re:»", () => {
  const p = buildPending({ ...base, channel: "email", external_id: "imap:<abc@x>" }, "  Hola Ana  ", "c1")
  assertEquals(p, { call_id: "c1", tool: "send_email", to_label: "Ana", address: "ana@example.com", subject: "Re: Visita", body: "Hola Ana", thread_id: base.id })
  const again = buildPending({ ...base, subject: "RE: Visita", channel: "email", external_id: "imap:<abc@x>" }, "Hola", "c2")
  assertEquals((again as { subject: string }).subject, "RE: Visita")
})

Deno.test("borrador de WhatsApp y de Telegram; textos vacíos o largos no", () => {
  assertEquals(buildPending({ ...base, channel: "whatsapp", external_id: "+5491122334455" }, "Hola", "c3"), {
    call_id: "c3", tool: "send_whatsapp", to_label: "Ana", phone: "+5491122334455", text: "Hola",
  })
  assertEquals(buildPending({ ...base, channel: "telegram", external_id: "12345" }, "Hola", "c4").tool, "send_telegram")
  throws(() => buildPending({ ...base, channel: "email", external_id: "imap:<abc@x>" }, "   ", "c5"), /Falta el texto/)
  throws(() => buildPending({ ...base, channel: "whatsapp", external_id: "+5491122334455" }, "x".repeat(1601), "c6"), /1600/)
  throws(() => buildPending({ ...base, channel: "email", external_id: "gmail:1" }, "Hola", "c7"), /no admite/)
})
