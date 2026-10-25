// deno test -A _shared/telegram-chat.test.ts
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert"

function assertStringIncludes(s: string, part: string) {
  assert(s.includes(part), `«${part}» no está en «${s.slice(0, 80)}…»`)
}
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import type { PendingAction } from "./agent.ts"
import { actionKey, approvableFromTelegram, approvalMessage, proposalDetail } from "./telegram-notice.ts"
import { handleCallback } from "./telegram-chat.ts"

const RUN = { id: "11111111-2222-3333-4444-555555555555", flow_name: "Correos sin responder" }

const SAMPLES: PendingAction[] = [
  { call_id: "call_a", tool: "send_email", to_label: "Ana", address: "ana@x.es", subject: "Re: obra", body: "Hola Ana" },
  { call_id: "call_b", tool: "send_telegram", to_label: "Luis", chat_id: "1", text: "Hola" },
  { call_id: "call_c", tool: "append_rows", file: "f1", file_name: "Cobros", range: "A1", values: [["a", 1, null]], before: null },
  { call_id: "call_d", tool: "update_range", file: "f1", file_name: "Cobros", range: "B2:B3", values: [[1], [2]], before: null },
  { call_id: "call_e", tool: "append_to_document", file: "f2", file_name: "Acta", text: "texto" },
  { call_id: "call_f", tool: "create_document", title: "Informe", text: "texto" },
  { call_id: "call_g", tool: "save_file", folder: "f3", folder_name: "Obras", name: "x.txt", format: "texto", text: "t" },
  { call_id: "call_h", tool: "create_event", event: { title: "Visita", start: "2026-10-27T10:00", end: "2026-10-27T11:00" }, attendees: [{ label: "Ana", email: "ana@x.es" }] },
  { call_id: "call_i", tool: "update_event", event_id: "e", title_before: "Visita", when_before: "lunes 10:00", changes: { start: "2026-10-28T10:00", attendees: ["a@x.es"] } },
  { call_id: "call_j", tool: "crm_create", object: "contacts", properties: { email: "ana@x.es" } },
  { call_id: "call_k", tool: "crm_update", object: "deals", id: "9", label: "Obra", properties: { dealstage: "won" }, before: { dealstage: "open" } },
  { call_id: "call_l", tool: "crm_note", object: "contacts", id: "9", label: "Ana", text: "nota" },
  { call_id: "call_m", tool: "crm_task", object: "contacts", id: "9", label: "Ana", subject: "Llamar", text: "", due_date: "2026-10-30" },
  { call_id: "call_n", tool: "tokko_lead", name: "Eva", email: "eva@x.es", phone: "", text: "Me interesa", property_ids: [1] },
]

Deno.test("cada acción tiene detalle y botones dentro del límite de Telegram", async () => {
  for (const p of SAMPLES) {
    assert(proposalDetail(p).length > 0, p.tool)
    const { text, keyboard } = await approvalMessage(RUN, p, "Título")
    assertStringIncludes(text, "Correos sin responder")
    if (p.tool === "update_range") {
      assertEquals(keyboard.length, 0)
      assertStringIncludes(text, "solo se puede aprobar en la app")
    } else {
      assertEquals(keyboard[0].length, 2)
      for (const b of keyboard[0]) assert(new TextEncoder().encode(b.callback_data).length <= 64, b.callback_data)
      assertEquals(keyboard[0][0].callback_data, `ap:${RUN.id}:${await actionKey(p.call_id)}`)
    }
  }
})

Deno.test("sobrescribir celdas no se aprueba desde Telegram", () => {
  assertEquals(approvableFromTelegram("update_range"), false)
  assertEquals(approvableFromTelegram("send_email"), true)
  assertEquals(approvableFromTelegram("algo_nuevo"), false)
})

Deno.test("la huella distingue acciones y es estable", async () => {
  assertEquals(await actionKey("call_a"), await actionKey("call_a"))
  assert((await actionKey("call_a")) !== (await actionKey("call_b")))
  assert(/^[0-9a-f]{12}$/.test(await actionKey("call_a")))
})

// Sin tocar la base de datos: un botón pulsado fuera del chat privado propio
// se rechaza antes de buscar a nadie.
Deno.test("botones de otro chat o de otra persona se rechazan", async () => {
  const answered: string[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (_url: string | URL | Request, init?: RequestInit) => {
    answered.push(String(JSON.parse(String(init?.body)).text ?? ""))
    return Promise.resolve(new Response(JSON.stringify({ ok: true, result: true })))
  }
  const admin = new Proxy({}, { get: () => { throw new Error("no debería consultar la base de datos") } }) as unknown as SupabaseClient
  try {
    const data = `ap:${RUN.id}:${await actionKey("call_a")}`
    await handleCallback(admin, "w", "token", { id: "1", from: { id: 7 }, data, message: { message_id: 1, date: 1, chat: { id: 8, type: "private" } } })
    await handleCallback(admin, "w", "token", { id: "2", from: { id: 8 }, data, message: { message_id: 1, date: 1, chat: { id: 8, type: "group" } } })
    await handleCallback(admin, "w", "token", { id: "3", from: { id: 8 }, data })
  } finally {
    globalThis.fetch = realFetch
  }
  assertEquals(answered, ["No autorizado.", "No autorizado.", "No autorizado."])
})
