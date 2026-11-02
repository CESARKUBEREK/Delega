// deno test -A _shared/router/core.test.ts
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert"
import { autoRunBudget, type Connection, costUsd, FALLBACK_CATALOG, type ModelInfo, rankModels, type RouteInput } from "./core.ts"

const catalog = FALLBACK_CATALOG
const info = (model: string) => catalog.find((c) => c.model === model)!
const openai: Connection[] = [{ provider: "openai", model: "gpt-6.1-sol", isDefault: true }]
const plan = (input: Partial<RouteInput> & Pick<RouteInput, "task" | "mode">) =>
  rankModels({ catalog, connections: openai, ...input })!

Deno.test("Inteligente: clasificar con el económico y trabajar con el modelo principal", () => {
  assertEquals(plan({ task: "classify", mode: "smart" }).primary, "gpt-6-luna")
  assertEquals(plan({ task: "help", mode: "smart" }).primary, "gpt-6-luna")
  assertEquals(plan({ task: "agent", mode: "smart" }).primary, "gpt-6.1-sol")
  assertEquals(plan({ task: "draft_reply", mode: "smart" }).primary, "gpt-6.1-sol")
  assertEquals(plan({ task: "plan", mode: "smart" }).primary, "gpt-6.1-sol")
})

Deno.test("Ahorro y Máxima calidad", () => {
  assertEquals(plan({ task: "classify", mode: "eco" }).primary, "gpt-6-luna")
  assertEquals(plan({ task: "agent", mode: "eco" }).primary, "gpt-6.1-sol")
  assertEquals(plan({ task: "agent", mode: "expert" }).primary, "gpt-6-astra")
  const anthropic: Connection[] = [{ provider: "anthropic", model: "claude-sonnet-5-5", isDefault: true }]
  assertEquals(rankModels({ catalog, connections: anthropic, task: "agent", mode: "expert" })!.primary, "claude-opus-5-5")
  assertEquals(rankModels({ catalog, connections: anthropic, task: "classify", mode: "smart" })!.primary, "claude-haiku-5-5")
})

Deno.test("El modelo que eligió la persona se respeta (DeepSeek Flash para todo en Inteligente)", () => {
  const ds: Connection[] = [{ provider: "deepseek", model: "deepseek-flash", isDefault: true }]
  assertEquals(rankModels({ catalog, connections: ds, task: "agent", mode: "smart" })!.primary, "deepseek-flash")
  // En Máxima calidad, el mejor que haya.
  assertEquals(rankModels({ catalog, connections: ds, task: "agent", mode: "expert" })!.primary, "deepseek-v4-pro")
  // Con Pro como principal, clasificar sigue yendo al económico.
  const pro: Connection[] = [{ provider: "deepseek", model: "deepseek-v4-pro", isDefault: true }]
  assertEquals(rankModels({ catalog, connections: pro, task: "classify", mode: "smart" })!.primary, "deepseek-flash")
})

Deno.test("Modelo fijado a mano", () => {
  const p = plan({ task: "agent", mode: "eco", fixedModel: "gpt-6-astra" })
  assertEquals(p.primary, "gpt-6-astra")
  assert(p.fixed)
  // Si su proveedor no está conectado, decide el router.
  assertEquals(plan({ task: "agent", mode: "smart", fixedModel: "claude-opus-5-5" }).primary, "gpt-6.1-sol")
})

Deno.test("Respaldo: primero de otro proveedor", () => {
  const two: Connection[] = [
    { provider: "openai", model: "gpt-6.1-sol", isDefault: true },
    { provider: "anthropic", model: "claude-sonnet-5-5", isDefault: false },
  ]
  const p = rankModels({ catalog, connections: two, task: "agent", mode: "smart" })!
  assertEquals(p.primary, "gpt-6.1-sol")
  assertEquals(info(p.fallbacks[0]).provider, "anthropic")
  assert(p.fallbacks.length <= 3)
  assert(!p.fallbacks.includes(p.primary))
  // Sin «usar otras IAs», la principal manda; con él, puede elegir otra.
  const cross = rankModels({ catalog, connections: two, task: "classify", mode: "eco", crossProvider: true })!
  assert(["gpt-6-luna", "claude-haiku-5-5"].includes(cross.primary))
})

Deno.test("Sin IA conectada no hay plan; modelos retirados fuera", () => {
  assertEquals(rankModels({ catalog, connections: [], task: "agent", mode: "smart" }), null)
  const retired: ModelInfo[] = catalog.map((c) => (c.model === "gpt-6-luna" ? { ...c, status: "deprecated" } : c))
  assertEquals(rankModels({ catalog: retired, connections: openai, task: "classify", mode: "smart" })!.primary, "gpt-6.1-sol")
})

Deno.test("Coste: caché, escritura en caché y contexto largo", () => {
  // 1M de entrada y 1M de salida con Sonnet: 2 + 10 $.
  assertEquals(costUsd(info("claude-sonnet-5-5"), { input: 1_000_000, output: 1_000_000 }), 12)
  // La mitad de la entrada en caché: 0,5 × 2 + 0,5 × 0,10.
  assertEquals(costUsd(info("claude-sonnet-5-5"), { input: 1_000_000, output: 0, cached: 500_000 }), 1.05)
  // Grok desde 200.000 tokens: precio largo en toda la petición.
  assertEquals(costUsd(info("grok-4.7"), { input: 200_000, output: 0 }), 0.8)
  assertEquals(costUsd(info("grok-4.7"), { input: 199_999, output: 0 }), 0.399998)
  assertEquals(costUsd(undefined, { input: 10, output: 10 }), 0)
})

Deno.test("Presupuesto automático por ejecución", () => {
  assertEquals(autoRunBudget("smart", []), 1)
  assertEquals(autoRunBudget("eco", [0.1]), 0.5)
  assertEquals(autoRunBudget("smart", [0.2, 0.3, 0.4]), 0.9)
  assertEquals(autoRunBudget("smart", [4, 4, 4]), 5)
})
