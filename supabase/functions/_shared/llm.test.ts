// Pruebas de la capa de proveedores con respuestas simuladas (sin red).
// deno test --config deno.json _shared/llm.test.ts
import { agentStep, anthropicSchema, type Conn, generate, isToolResult, LLMError, pushToolResult, type ToolDef } from "./llm.ts"

type Captured = { url: string; headers: Record<string, string>; body: Record<string, unknown> }

function mockFetch(responses: { status?: number; body: unknown }[]): Captured[] {
  const captured: Captured[] = []
  let i = 0
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    captured.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : {},
    })
    const r = responses[Math.min(i++, responses.length - 1)]
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status ?? 200 }))
  }) as typeof fetch
  return captured
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
function eq(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}\n  esperado: ${JSON.stringify(b)}\n  obtenido: ${JSON.stringify(a)}`)
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "plan"],
  properties: { reply: { type: "string", maxLength: 100 }, plan: { anyOf: [{ type: "null" }, { type: "object", properties: { n: { type: "integer", minimum: 1 } } }] } },
}
const TOOLS: ToolDef[] = [{
  type: "function",
  name: "read_range",
  description: "Lee un rango",
  strict: true,
  parameters: { type: "object", additionalProperties: false, required: ["range"], properties: { range: { type: "string" } } },
}]

const conn = (provider: Conn["provider"], model: string): Conn => ({ provider, model, apiKey: "sk-test-000000000000000000000" })

Deno.test("anthropicSchema quita límites no admitidos y cierra objetos", () => {
  const out = anthropicSchema(SCHEMA) as { properties: Record<string, { maxLength?: number; anyOf?: { properties?: { n: { minimum?: number } }; additionalProperties?: boolean }[] }> }
  assert(out.properties.reply.maxLength === undefined, "maxLength debería desaparecer")
  const obj = out.properties.plan.anyOf![1]
  assert(obj.additionalProperties === false, "los objetos deben llevar additionalProperties false")
  assert(obj.properties!.n.minimum === undefined, "minimum debería desaparecer")
})

Deno.test("OpenAI: JSON estructurado con Responses API", async () => {
  const cap = mockFetch([{
    body: {
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: '{"reply":"hola","plan":null}' }] }],
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  }])
  const out = await generate(conn("openai", "gpt-6.1-sol"), {
    instructions: "x",
    messages: [{ role: "user", content: "hola" }],
    schema: { name: "p", schema: SCHEMA },
    maxTokens: 100,
    timeoutMs: 1000,
  })
  eq(out.json, { reply: "hola", plan: null }, "JSON de OpenAI")
  eq(out.usage, { input: 10, output: 5 }, "uso de OpenAI")
  assert(cap[0].url === "https://api.openai.com/v1/responses", "URL de OpenAI")
  eq((cap[0].body.text as { format: { type: string } }).format.type, "json_schema", "formato de OpenAI")
  assert(cap[0].headers.Authorization === "Bearer sk-test-000000000000000000000", "cabecera de OpenAI")
})

Deno.test("Anthropic: JSON con output_config.format y cabeceras propias", async () => {
  const cap = mockFetch([{
    body: {
      content: [{ type: "thinking", thinking: "...", signature: "s" }, { type: "text", text: '{"reply":"ok","plan":null}' }],
      stop_reason: "end_turn",
      usage: { input_tokens: 7, cache_read_input_tokens: 3, output_tokens: 4 },
    },
  }])
  const out = await generate(conn("anthropic", "claude-sonnet-5-5"), {
    instructions: "sistema",
    messages: [{ role: "user", content: "hola" }],
    schema: { name: "p", schema: SCHEMA },
    maxTokens: 100,
    timeoutMs: 1000,
    effort: "low",
  })
  eq(out.json, { reply: "ok", plan: null }, "JSON de Anthropic")
  eq(out.usage, { input: 10, output: 4 }, "uso de Anthropic (incluye caché)")
  assert(cap[0].url === "https://api.anthropic.com/v1/messages", "URL de Anthropic")
  assert(cap[0].headers["x-api-key"] && cap[0].headers["anthropic-version"] === "2023-06-01", "cabeceras de Anthropic")
  assert(cap[0].body.system === "sistema", "system de Anthropic")
  const oc = cap[0].body.output_config as { effort: string; format: { type: string; schema: { properties: { reply: { maxLength?: number } } } } }
  eq(oc.effort, "low", "effort de Anthropic")
  eq(oc.format.type, "json_schema", "formato de Anthropic")
  assert(oc.format.schema.properties.reply.maxLength === undefined, "el esquema se adapta para Anthropic")
})

Deno.test("Anthropic: sin esquema ni effort no envía output_config", async () => {
  const cap = mockFetch([{ body: { content: [{ type: "text", text: "Hola" }], stop_reason: "end_turn", usage: {} } }])
  const out = await generate(conn("anthropic", "claude-haiku-5-5"), { instructions: "x", messages: [{ role: "user", content: "a" }], maxTokens: 50, timeoutMs: 1000 })
  eq(out.text, "Hola", "texto de Anthropic")
  assert(!("output_config" in cap[0].body), "no debe enviar output_config vacío")
})

Deno.test("DeepSeek: json_object, esquema en el sistema y un reintento si el JSON falla", async () => {
  const cap = mockFetch([
    { body: { choices: [{ finish_reason: "stop", message: { content: "" } }], usage: { prompt_tokens: 5, completion_tokens: 1 } } },
    { body: { choices: [{ finish_reason: "stop", message: { content: '```json\n{"reply":"r","plan":null}\n```' } }], usage: { prompt_tokens: 6, completion_tokens: 2 } } },
  ])
  const out = await generate(conn("deepseek", "deepseek-flash"), {
    instructions: "x",
    messages: [{ role: "user", content: "hola" }],
    schema: { name: "p", schema: SCHEMA },
    maxTokens: 100,
    timeoutMs: 1000,
    effort: "low",
  })
  eq(out.json, { reply: "r", plan: null }, "JSON de DeepSeek tras reintento")
  eq(out.usage, { input: 11, output: 3 }, "uso acumulado de DeepSeek")
  assert(cap.length === 2, "debe reintentar una vez")
  assert(cap[0].url === "https://api.deepseek.com/chat/completions", "URL de DeepSeek")
  eq(cap[0].body.response_format, { type: "json_object" }, "json_object en DeepSeek")
  eq(cap[0].body.reasoning_effort, "low", "esfuerzo bajo en DeepSeek")
  const sys = (cap[0].body.messages as { role: string; content: string }[])[0]
  assert(sys.role === "system" && sys.content.includes("JSON Schema"), "el esquema va en el mensaje de sistema")
})

Deno.test("Kimi: URL, max_completion_tokens y esfuerzo por defecto en K3", async () => {
  const cap = mockFetch([{ body: { choices: [{ finish_reason: "stop", message: { content: "Hola" } }], usage: {} } }])
  await generate(conn("kimi", "kimi-k3"), { instructions: "x", messages: [{ role: "user", content: "a" }], maxTokens: 100, timeoutMs: 1000 })
  assert(cap[0].url === "https://api.moonshot.ai/v1/chat/completions", "URL de Kimi")
  assert(typeof cap[0].body.max_completion_tokens === "number" && !("max_tokens" in cap[0].body), "Kimi usa max_completion_tokens")
  eq(cap[0].body.reasoning_effort, "high", "K3 con esfuerzo alto, no máximo")
})

Deno.test("Errores: 401 es clave rechazada, 402 y 429 son límite", async () => {
  for (const [status, code] of [[401, "invalid_key"], [402, "limit"], [429, "limit"], [500, "provider"]] as const) {
    mockFetch([{ status, body: { error: { message: "x" } } }])
    try {
      await generate(conn("deepseek", "deepseek-flash"), { instructions: "x", messages: [{ role: "user", content: "a" }], maxTokens: 10, timeoutMs: 1000 })
      throw new Error("debería fallar")
    } catch (e) {
      assert(e instanceof LLMError && e.code === code, `HTTP ${status} → ${code}, obtenido ${e instanceof LLMError ? e.code : e}`)
    }
  }
})

Deno.test("Agente Anthropic: devuelve los bloques de razonamiento y agrupa los resultados", async () => {
  const items: unknown[] = [{ role: "user", content: "Ejecuta" }]
  const cap = mockFetch([
    {
      body: {
        content: [
          { type: "thinking", thinking: "pienso", signature: "sig" },
          { type: "tool_use", id: "tu_1", name: "read_range", input: { range: "A1" } },
          { type: "tool_use", id: "tu_2", name: "read_range", input: { range: "B1" } },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 20, output_tokens: 8 },
      },
    },
    { body: { content: [{ type: "text", text: "Hecho." }], stop_reason: "end_turn", usage: {} } },
  ])
  const c = conn("anthropic", "claude-sonnet-5-5")
  const step = await agentStep(c, { instructions: "x", items, tools: TOOLS, maxTokens: 100, timeoutMs: 1000 })
  eq(step.calls.map((x) => x.id), ["tu_1", "tu_2"], "llamadas de Anthropic")
  eq(JSON.parse(step.calls[0].arguments), { range: "A1" }, "argumentos como JSON")
  eq(cap[0].body.tool_choice, { type: "auto", disable_parallel_tool_use: true }, "una herramienta cada vez")
  eq((cap[0].body.tools as { input_schema: unknown }[])[0].input_schema, TOOLS[0].parameters, "input_schema de la herramienta")

  pushToolResult("anthropic", items, "tu_2", "omitido")
  pushToolResult("anthropic", items, "tu_1", '{"rows":1}')
  assert(items.length === 3, "los resultados van en un único mensaje del usuario")
  const results = (items[2] as { content: { tool_use_id: string }[] }).content.map((b) => b.tool_use_id)
  eq(results, ["tu_2", "tu_1"], "ambos resultados en el mismo mensaje")
  assert(isToolResult(items[2]), "isToolResult reconoce resultados de Anthropic")

  const final = await agentStep(c, { instructions: "x", items, tools: TOOLS, maxTokens: 100, timeoutMs: 1000 })
  const sent = cap[1].body.messages as { role: string; content: { type: string; signature?: string }[] }[]
  assert(sent[1].content[0].type === "thinking" && sent[1].content[0].signature === "sig", "el razonamiento vuelve intacto")
  eq(final.text, "Hecho.", "texto final")
  eq(final.calls.length, 0, "sin más llamadas")
})

Deno.test("Agente DeepSeek: reasoning_content y tool_calls vuelven en el siguiente paso", async () => {
  const items: unknown[] = [{ role: "user", content: "Ejecuta" }]
  const cap = mockFetch([
    {
      body: {
        choices: [{
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: null,
            reasoning_content: "razono",
            tool_calls: [{ id: "call_1", type: "function", function: { name: "read_range", arguments: '{"range":"A1"}' } }],
          },
        }],
        usage: { prompt_tokens: 30, completion_tokens: 9 },
      },
    },
    { body: { choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Listo" } }], usage: {} } },
  ])
  const c = conn("deepseek", "deepseek-v4-pro")
  const step = await agentStep(c, { instructions: "sis", items, tools: TOOLS, maxTokens: 100, timeoutMs: 1000 })
  eq(step.calls, [{ id: "call_1", name: "read_range", arguments: '{"range":"A1"}' }], "llamada de DeepSeek")
  eq(step.usage, { input: 30, output: 9 }, "uso de DeepSeek")
  const tool = (cap[0].body.tools as { type: string; function: { name: string; strict?: boolean } }[])[0]
  assert(tool.type === "function" && tool.function.name === "read_range" && tool.function.strict === undefined, "herramienta en formato Chat Completions")
  assert((cap[0].body.messages as { role: string }[])[0].role === "system", "instrucciones como mensaje de sistema")

  pushToolResult("deepseek", items, "call_1", '{"rows":1}')
  assert(isToolResult(items[2]), "isToolResult reconoce role tool")
  await agentStep(c, { instructions: "sis", items, tools: TOOLS, maxTokens: 100, timeoutMs: 1000 })
  const sent = cap[1].body.messages as { role: string; reasoning_content?: string; tool_calls?: unknown[]; tool_call_id?: string }[]
  eq(sent.map((m) => m.role), ["system", "user", "assistant", "tool"], "orden de mensajes")
  eq(sent[2].reasoning_content, "razono", "reasoning_content devuelto")
  assert(sent[2].tool_calls?.length === 1 && sent[3].tool_call_id === "call_1", "tool_calls y su resultado")
  eq((items[3] as { content: string }).content, "Listo", "respuesta final guardada")
})

Deno.test("Agente Kimi: herramientas no estrictas y K2.6 conserva el razonamiento", async () => {
  const cap = mockFetch([{ body: { choices: [{ finish_reason: "stop", message: { content: "Fin" } }], usage: {} } }])
  await agentStep(conn("kimi", "kimi-k2.6"), { instructions: "x", items: [{ role: "user", content: "a" }], tools: TOOLS, maxTokens: 100, timeoutMs: 1000 })
  const tool = (cap[0].body.tools as { function: { strict?: boolean } }[])[0]
  eq(tool.function.strict, false, "Kimi con strict false")
  eq(cap[0].body.thinking, { type: "enabled", keep: "all" }, "K2.6 con keep all")
})

Deno.test("Agente OpenAI: mantiene el formato de Responses API", async () => {
  const items: unknown[] = [{ role: "user", content: "a" }]
  const cap = mockFetch([{
    body: {
      status: "completed",
      output: [{ type: "function_call", call_id: "fc_1", name: "read_range", arguments: '{"range":"A1"}' }],
      usage: { input_tokens: 3, output_tokens: 2 },
    },
  }])
  const step = await agentStep(conn("openai", "gpt-6.1-sol"), { instructions: "x", items, tools: TOOLS, maxTokens: 100, timeoutMs: 1000 })
  eq(step.calls, [{ id: "fc_1", name: "read_range", arguments: '{"range":"A1"}' }], "llamada de OpenAI")
  eq(cap[0].body.tools, TOOLS, "herramientas sin cambios")
  pushToolResult("openai", items, "fc_1", "ok")
  eq(items[2], { type: "function_call_output", call_id: "fc_1", output: "ok" }, "resultado de OpenAI")
})
