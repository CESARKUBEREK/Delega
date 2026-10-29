// Cliente de Buffer con fetch simulado: consultas, modos de publicación y errores.
// deno test -A _shared/buffer.test.ts
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert"
import { BufferError, checkKey, createPost, listChannels } from "./buffer.ts"

function assertStringIncludes(s: string, part: string) {
  assert(s.includes(part), `«${part}» no está en «${s.slice(0, 120)}…»`)
}

async function assertRejects(fn: () => Promise<unknown>, type: typeof BufferError, part: string) {
  try {
    await fn()
  } catch (e) {
    assert(e instanceof type, `error de otro tipo: ${e}`)
    assertStringIncludes((e as Error).message, part)
    return
  }
  throw new Error("no lanzó ningún error")
}

type Call = { auth: string | null; query: string }

function mockFetch(handler: (query: string) => { status?: number; body: unknown }): Call[] {
  const calls: Call[] = []
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
    const query = (JSON.parse(String(init?.body ?? "{}")) as { query: string }).query
    calls.push({ auth: new Headers(init?.headers).get("Authorization"), query })
    const { status = 200, body } = handler(query)
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  }) as typeof fetch
  return calls
}

const realFetch = globalThis.fetch

Deno.test("lista los canales de todas las organizaciones", async () => {
  const calls = mockFetch((q) =>
    q.includes("organizations")
      ? { body: { data: { account: { organizations: [{ id: "o1", name: "Inmobiliaria" }] } } } }
      : { body: { data: { channels: [{ id: "c1", name: "insta", displayName: "Inmobiliaria Sur", service: "instagram", isQueuePaused: false }] } } },
  )
  const channels = await listChannels("clave-de-prueba-0000000000")
  assertEquals(channels, [{ id: "c1", name: "Inmobiliaria Sur", service: "instagram", organization: "Inmobiliaria", paused: false }])
  assertEquals(calls[0].auth, "Bearer clave-de-prueba-0000000000")
  assertStringIncludes(calls[1].query, 'organizationId: "o1"')
  assertEquals((await checkKey("clave-de-prueba-0000000000")).channels, 1)
  globalThis.fetch = realFetch
})

Deno.test("publica en la cola o programada, con el texto escapado", async () => {
  const calls = mockFetch(() => ({ body: { data: { createPost: { post: { id: "p1" } } } } }))
  await createPost("k".repeat(30), { channelId: "c1", text: 'Piso "nuevo"\nen venta', dueAt: null })
  assertStringIncludes(calls[0].query, "mode: addToQueue")
  assertStringIncludes(calls[0].query, 'text: "Piso \\"nuevo\\"\\nen venta"')
  await createPost("k".repeat(30), { channelId: "c1", text: "Hola", dueAt: "2026-11-02T09:00:00.000Z" })
  assertStringIncludes(calls[1].query, 'mode: customScheduled, dueAt: "2026-11-02T09:00:00.000Z"')
  assert(!calls[1].query.includes("addToQueue"))
  globalThis.fetch = realFetch
})

Deno.test("errores: clave rechazada, límite y publicación no creada", async () => {
  mockFetch(() => ({ status: 401, body: { errors: [{ message: "nope" }] } }))
  await assertRejects(() => listChannels("k".repeat(30)), BufferError, "no reconoce")
  mockFetch(() => ({ status: 429, body: { errors: [{ message: "x", extensions: { code: "RATE_LIMIT_EXCEEDED" } }] } }))
  await assertRejects(() => listChannels("k".repeat(30)), BufferError, "límite")
  mockFetch(() => ({ body: { data: { createPost: { message: "Canal en pausa" } } } }))
  await assertRejects(() => createPost("k".repeat(30), { channelId: "c1", text: "x", dueAt: null }), BufferError, "Canal en pausa")
  globalThis.fetch = realFetch
})
