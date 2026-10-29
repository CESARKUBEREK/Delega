// deno test -A _shared/voice.test.ts
// Horario de citas, zonas horarias y huecos libres del agente telefónico.
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert"
import { DEFAULT_VOICE_CONFIG, describeHours, freeSlots, localToUtc, playbook, readVoiceConfig, sameToken, voiceTools } from "./voice.ts"

const TZ = "Europe/Paris"

Deno.test("hora local → UTC, también con el cambio de hora", () => {
  // Martes 3 nov 2026: invierno (UTC+1).
  assertEquals(new Date(localToUtc("2026-11-03", "10:00", TZ)).toISOString(), "2026-11-03T09:00:00.000Z")
  // 20 oct 2026: verano (UTC+2).
  assertEquals(new Date(localToUtc("2026-10-20", "10:00", TZ)).toISOString(), "2026-10-20T08:00:00.000Z")
  assertEquals(new Date(localToUtc("2026-11-03", "10:00", "America/Argentina/Buenos_Aires")).toISOString(), "2026-11-03T13:00:00.000Z")
})

Deno.test("la configuración se limpia y tiene valores por defecto", () => {
  assertEquals(readVoiceConfig(null), DEFAULT_VOICE_CONFIG)
  const c = readVoiceConfig({ days: [5, 1, 9, 1], ranges: [{ from: "10:00", to: "09:00" }, { from: "08:30", to: "12:00" }], slot_minutes: 5, file_ids: ["x", "0b0950e7-eeb3-4c27-9753-a026aaf1b22a"] })
  assertEquals(c.days, [1, 5])
  assertEquals(c.ranges, [{ from: "08:30", to: "12:00" }])
  assertEquals(c.slot_minutes, 30)
  assertEquals(c.file_ids, ["0b0950e7-eeb3-4c27-9753-a026aaf1b22a"])
  assertEquals(describeHours(c), "lunes, viernes; 08:30-12:00")
})

Deno.test("huecos libres: horario, ocupado, antelación y días sin citas", () => {
  const c = { ...DEFAULT_VOICE_CONFIG, ranges: [{ from: "09:00", to: "11:00" }], slot_minutes: 30 }
  const now = Date.parse("2026-11-01T12:00:00Z")
  const busy = [{ start: localToUtc("2026-11-03", "09:30", TZ), end: localToUtc("2026-11-03", "10:00", TZ) }]
  assertEquals(freeSlots(c, "2026-11-03", 30, busy, TZ, now), ["09:00", "10:00", "10:30"])
  // Una cita de 60 min no cabe donde se solaparía.
  assertEquals(freeSlots(c, "2026-11-03", 60, busy, TZ, now), ["10:00"])
  // Domingo: sin citas.
  assertEquals(freeSlots(c, "2026-11-08", 30, [], TZ, now), [])
  // Con menos de 30 min de antelación no se ofrece.
  const soon = localToUtc("2026-11-03", "09:10", TZ)
  assertEquals(freeSlots(c, "2026-11-03", 30, [], TZ, soon), ["10:00", "10:30"])
})

Deno.test("herramientas: documentos solo si hay archivos elegidos", () => {
  assertEquals(voiceTools(DEFAULT_VOICE_CONFIG).map((t) => t.name), ["huecos_libres", "reservar_cita", "tomar_recado"])
  const withDocs = voiceTools({ ...DEFAULT_VOICE_CONFIG, file_ids: ["0b0950e7-eeb3-4c27-9753-a026aaf1b22a"] })
  assert(withDocs.some((t) => t.name === "leer_documento"))
  assert(playbook("Inmobiliaria Sur", DEFAULT_VOICE_CONFIG).includes("reservar_cita"))
})

Deno.test("comparación de la clave", () => {
  assert(sameToken("msv_abc", "msv_abc"))
  assert(!sameToken("msv_abc", "msv_abd"))
  assert(!sameToken("msv_abc", "msv_abcd"))
})
