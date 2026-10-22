// Capa común para los proveedores de IA (BYOK): OpenAI, Anthropic, DeepSeek y Kimi.
//
// - generate(): una respuesta de texto o JSON (asistente, bandeja).
// - agentStep(): un paso del agente con herramientas.
//
// Cada ejecución del agente guarda la conversación en el formato nativo de su
// proveedor (state.items), así los bloques de razonamiento que algunos exigen
// devolver (Anthropic, DeepSeek, Kimi) viajan intactos de un paso al siguiente.
// Las claves se descifran solo en memoria y nunca se registran.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

export const PROVIDER_IDS = ["openai", "anthropic", "deepseek", "kimi"] as const
export type Provider = (typeof PROVIDER_IDS)[number]

type ProviderInfo = {
  label: string
  models: readonly string[]
  keyRe: RegExp
  keyHint: string
  console: string
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  openai: {
    label: "OpenAI",
    models: ["gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna"],
    keyRe: /^sk-[A-Za-z0-9_-]{20,300}$/,
    keyHint: "empieza por sk-",
    console: "platform.openai.com",
  },
  anthropic: {
    label: "Anthropic",
    models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
    keyRe: /^sk-ant-[A-Za-z0-9_-]{20,300}$/,
    keyHint: "empieza por sk-ant-",
    console: "platform.claude.com",
  },
  deepseek: {
    label: "DeepSeek",
    models: ["deepseek-flash", "deepseek-v4-pro"],
    keyRe: /^sk-[A-Za-z0-9_-]{20,300}$/,
    keyHint: "empieza por sk-",
    console: "platform.deepseek.com",
  },
  kimi: {
    label: "Kimi",
    models: ["kimi-k3", "kimi-k2.6"],
    keyRe: /^sk-[A-Za-z0-9_-]{20,300}$/,
    keyHint: "empieza por sk-",
    console: "platform.kimi.ai",
  },
}

export function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && (PROVIDER_IDS as readonly string[]).includes(value)
}

const CHAT_BASE: Record<"deepseek" | "kimi", string> = {
  deepseek: "https://api.deepseek.com",
  kimi: "https://api.moonshot.ai/v1",
}
const ANTHROPIC = "https://api.anthropic.com/v1"
const ANTHROPIC_VERSION = "2023-06-01"

// Margen de salida para el razonamiento interno de los modelos que piensan.
const THINKING_HEADROOM = 16_000

export type LLMErrorCode = "invalid_key" | "limit" | "timeout" | "provider" | "incomplete" | "refusal" | "bad_output"

export class LLMError extends Error {
  constructor(public code: LLMErrorCode, message: string) {
    super(message)
  }
}

export type Conn = { provider: Provider; model: string; apiKey: string }
export type Usage = { input: number; output: number }

// ---------------------------------------------------------------------------
// Conexiones del espacio
// ---------------------------------------------------------------------------
type Lookup = { conn: Conn } | { error: string; code: "no_connection" | "invalid_key" }

async function lookup(admin: SupabaseClient, workspaceId: string, provider: Provider): Promise<Lookup> {
  const { data } = await admin.rpc("ai_connection_secret", { p_workspace_id: workspaceId, p_provider: provider })
  const row = data?.[0] as { api_key: string; model: string; status: string } | undefined
  const label = PROVIDERS[provider].label
  if (!row) return { error: `Conecta una clave de ${label} en Integraciones.`, code: "no_connection" }
  if (row.status !== "active") {
    return { error: `La clave de ${label} de este espacio dejó de funcionar. Actualízala en Integraciones.`, code: "invalid_key" }
  }
  return { conn: { provider, model: row.model, apiKey: row.api_key } }
}

// Proveedor por defecto del espacio (el que usan el asistente, la bandeja y las
// automatizaciones nuevas).
export async function defaultConnection(admin: SupabaseClient, workspaceId: string): Promise<Lookup> {
  const { data } = await admin.from("ai_connections").select("provider").eq("workspace_id", workspaceId).eq("is_default", true).maybeSingle()
  let provider = data?.provider as string | undefined
  if (!provider) {
    const { data: ensured } = await admin.rpc("ai_connection_ensure_default", { p_workspace_id: workspaceId })
    provider = typeof ensured === "string" ? ensured : undefined
  }
  if (!isProvider(provider)) {
    return { error: "Conecta un proveedor de IA (OpenAI, Anthropic, DeepSeek o Kimi) en Integraciones.", code: "no_connection" }
  }
  return await lookup(admin, workspaceId, provider)
}

// Conexión de un proveedor concreto (una ejecución sigue con el suyo).
export async function connectionFor(admin: SupabaseClient, workspaceId: string, provider: Provider): Promise<Lookup> {
  return await lookup(admin, workspaceId, provider)
}

export async function markInvalid(admin: SupabaseClient, workspaceId: string, provider: Provider) {
  await admin.rpc("ai_connection_mark_invalid", { p_workspace_id: workspaceId, p_provider: provider })
}

export async function recordUsage(
  admin: SupabaseClient,
  e: { workspaceId: string; conn: Conn; model?: string; usage: Usage; createdBy: string | null; conversationId?: string | null },
) {
  await admin.from("usage_events").insert({
    workspace_id: e.workspaceId,
    provider: e.conn.provider,
    model: e.model ?? e.conn.model,
    input_tokens: e.usage.input,
    output_tokens: e.usage.output,
    created_by: e.createdBy,
    ...(e.conversationId ? { conversation_id: e.conversationId } : {}),
  })
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
function headers(provider: Provider, apiKey: string): Record<string, string> {
  if (provider === "anthropic") {
    return { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "Content-Type": "application/json" }
  }
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
}

async function post(conn: Conn, url: string, body: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
  const label = PROVIDERS[conn.provider].label
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: headers(conn.provider, conn.apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new LLMError("timeout", `${label} tardó demasiado en responder. Inténtalo de nuevo.`)
  }
  if (res.status === 401) {
    await res.body?.cancel()
    throw new LLMError("invalid_key", `${label} ha rechazado la clave de este espacio. Actualízala en Integraciones.`)
  }
  if (res.status === 403) {
    await res.body?.cancel()
    throw new LLMError("provider", `${label} no permite esta petición con esta clave (revisa sus permisos o si el modelo está disponible en tu cuenta).`)
  }
  if (res.status === 402 || res.status === 429) {
    await res.body?.cancel()
    throw new LLMError("limit", `Tu cuenta de ${label} ha llegado a su límite o no tiene saldo. Revísalo en ${PROVIDERS[conn.provider].console}.`)
  }
  if (res.status === 529 || res.status === 503) {
    await res.body?.cancel()
    throw new LLMError("provider", `${label} está saturado ahora mismo. Inténtalo en unos minutos.`)
  }
  if (!res.ok) {
    // Solo el tipo de error, nunca el cuerpo de la petición.
    const detail = await res.json().catch(() => null) as { error?: { message?: string; type?: string } } | null
    const msg = typeof detail?.error?.message === "string" ? `: ${detail.error.message.slice(0, 200)}` : ""
    throw new LLMError("provider", `${label} no pudo procesar la petición (${res.status})${msg}`)
  }
  return await res.json() as Record<string, unknown>
}

// Comprueba una clave con una llamada sin coste (listar modelos).
export async function validateKey(provider: Provider, apiKey: string): Promise<void> {
  const label = PROVIDERS[provider].label
  const url = provider === "openai"
    ? "https://api.openai.com/v1/models"
    : provider === "anthropic"
      ? `${ANTHROPIC}/models?limit=1`
      : `${CHAT_BASE[provider]}/models`
  let res: Response
  try {
    res = await fetch(url, { headers: headers(provider, apiKey), signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new LLMError("timeout", `No se pudo contactar con ${label}. Inténtalo de nuevo.`)
  }
  await res.body?.cancel()
  if (res.status === 401) throw new LLMError("invalid_key", `${label} ha rechazado la clave. Revisa que esté copiada entera y activa.`)
  if (res.status === 403) throw new LLMError("invalid_key", `La clave no tiene permiso para usar la API de ${label}. Revisa sus permisos.`)
  if (!res.ok) throw new LLMError("provider", `${label} no respondió correctamente. Inténtalo en unos minutos.`)
}

// ---------------------------------------------------------------------------
// Esquemas JSON
// ---------------------------------------------------------------------------
// Anthropic no admite límites numéricos ni de longitud en los esquemas de salida.
const UNSUPPORTED = new Set(["minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "maxItems"])

export function anthropicSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(anthropicSchema)
  if (!schema || typeof schema !== "object") return schema
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (UNSUPPORTED.has(k)) continue
    if (k === "minItems" && typeof v === "number" && v > 1) continue
    out[k] = k === "properties" && v && typeof v === "object"
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([p, s]) => [p, anthropicSchema(s)]))
      : anthropicSchema(v)
  }
  if (out.type === "object" && out.additionalProperties === undefined) out.additionalProperties = false
  return out
}

// ---------------------------------------------------------------------------
// Texto o JSON
// ---------------------------------------------------------------------------
export type Message = { role: "user" | "assistant"; content: string }

export type GenerateInput = {
  instructions: string
  messages: Message[]
  schema?: { name: string; schema: Record<string, unknown> }
  maxTokens: number
  timeoutMs: number
  // "low": tareas sencillas y repetitivas (clasificar). Por defecto, el del proveedor.
  effort?: "low"
}

export type Generated = { text: string; json: unknown; usage: Usage }

function parseJson(text: string, label: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new LLMError("bad_output", `La respuesta de ${label} no tenía el formato esperado. Inténtalo de nuevo.`)
  }
}

export async function generate(conn: Conn, input: GenerateInput): Promise<Generated> {
  const label = PROVIDERS[conn.provider].label
  if (conn.provider === "openai") {
    const r = await post(conn, "https://api.openai.com/v1/responses", {
      model: conn.model,
      instructions: input.instructions,
      input: input.messages,
      ...(input.schema
        ? { text: { format: { type: "json_schema", name: input.schema.name, schema: input.schema.schema, strict: true } } }
        : {}),
      store: false,
      max_output_tokens: input.maxTokens,
    }, input.timeoutMs) as {
      status?: string
      output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[]
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const usage = { input: n(r.usage?.input_tokens), output: n(r.usage?.output_tokens) }
    if (r.status === "incomplete") throw new LLMError("incomplete", "La respuesta quedó incompleta. Prueba con una petición más concreta.")
    const content = r.output?.find((o) => o.type === "message")?.content ?? []
    if (content.some((c) => c.type === "refusal")) throw new LLMError("refusal", "No puedo ayudar con esa petición.")
    const text = content.filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("")
    return { text, json: input.schema ? parseJson(text, label) : null, usage }
  }

  if (conn.provider === "anthropic") {
    const r = await post(conn, `${ANTHROPIC}/messages`, {
      model: conn.model,
      max_tokens: input.maxTokens + THINKING_HEADROOM,
      system: input.instructions,
      messages: input.messages,
      ...(input.effort || input.schema
        ? {
          output_config: {
            ...(input.effort ? { effort: input.effort } : {}),
            ...(input.schema ? { format: { type: "json_schema", schema: anthropicSchema(input.schema.schema) } } : {}),
          },
        }
        : {}),
    }, input.timeoutMs) as AnthropicResponse
    const usage = anthropicUsage(r)
    if (r.stop_reason === "refusal") throw new LLMError("refusal", "No puedo ayudar con esa petición.")
    if (r.stop_reason === "max_tokens") throw new LLMError("incomplete", "La respuesta quedó incompleta. Prueba con una petición más concreta.")
    const text = (r.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("")
    return { text, json: input.schema ? parseJson(text, label) : null, usage }
  }

  // DeepSeek y Kimi: Chat Completions compatible con OpenAI. El esquema va en
  // las instrucciones y se pide un objeto JSON.
  const system = input.schema
    ? `${input.instructions}\n\nResponde únicamente con un objeto JSON válido que cumpla este JSON Schema:\n${JSON.stringify(input.schema.schema)}`
    : input.instructions
  const call = async (messages: Message[]) => {
    const r = await post(conn, `${CHAT_BASE[conn.provider as "deepseek" | "kimi"]}/chat/completions`, {
      model: conn.model,
      messages: [{ role: "system", content: system }, ...messages],
      ...(input.schema ? { response_format: { type: "json_object" } } : {}),
      ...chatLimits(conn, input.maxTokens),
      ...chatEffort(conn, input.effort),
    }, input.timeoutMs) as ChatResponse
    const choice = r.choices?.[0]
    const usage = { input: n(r.usage?.prompt_tokens), output: n(r.usage?.completion_tokens) }
    if (choice?.finish_reason === "content_filter") throw new LLMError("refusal", "No puedo ayudar con esa petición.")
    if (choice?.finish_reason === "length") throw new LLMError("incomplete", "La respuesta quedó incompleta. Prueba con una petición más concreta.")
    return { text: choice?.message?.content ?? "", usage }
  }
  const first = await call(input.messages)
  if (!input.schema) return { text: first.text, json: null, usage: first.usage }
  try {
    return { text: first.text, json: parseJson(first.text, label), usage: first.usage }
  } catch {
    // Un reintento: estos modelos a veces devuelven el JSON vacío o con texto alrededor.
    const retry = await call([
      ...input.messages,
      { role: "assistant", content: first.text || "(vacío)" },
      { role: "user", content: "Tu respuesta no era un objeto JSON válido. Devuelve solo el objeto JSON, sin texto alrededor." },
    ])
    const usage = { input: first.usage.input + retry.usage.input, output: first.usage.output + retry.usage.output }
    return { text: retry.text, json: parseJson(retry.text, label), usage }
  }
}

function chatLimits(conn: Conn, maxTokens: number) {
  return conn.provider === "kimi"
    ? { max_completion_tokens: maxTokens + THINKING_HEADROOM }
    : { max_tokens: maxTokens + THINKING_HEADROOM }
}

function chatEffort(conn: Conn, effort: "low" | undefined) {
  if (conn.provider === "deepseek") return effort ? { reasoning_effort: effort } : {}
  // Kimi K3 siempre razona; por defecto al máximo, que es lento para un panel.
  if (conn.model === "kimi-k3") return { reasoning_effort: effort ?? "high" }
  return {}
}

const n = (v: unknown) => Math.max(0, Math.trunc(typeof v === "number" ? v : 0))

type AnthropicBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown }
type AnthropicResponse = {
  content?: AnthropicBlock[]
  stop_reason?: string
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
}
function anthropicUsage(r: AnthropicResponse): Usage {
  return {
    input: n(r.usage?.input_tokens) + n(r.usage?.cache_creation_input_tokens) + n(r.usage?.cache_read_input_tokens),
    output: n(r.usage?.output_tokens),
  }
}

type ChatToolCall = { id: string; type: string; function: { name: string; arguments: string } }
type ChatResponse = {
  choices?: {
    finish_reason?: string
    message?: { role?: string; content?: string | null; reasoning_content?: string | null; tool_calls?: ChatToolCall[] }
  }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

// ---------------------------------------------------------------------------
// Agente con herramientas
// ---------------------------------------------------------------------------
// Herramienta en formato neutro (el que ya usaba el agente con OpenAI).
export type ToolDef = { type: "function"; name: string; description: string; strict?: boolean; parameters: Record<string, unknown> }
export type ToolCall = { id: string; name: string; arguments: string }
export type Step = { calls: ToolCall[]; text: string; usage: Usage; incomplete: boolean }

export async function agentStep(
  conn: Conn,
  input: { instructions: string; items: unknown[]; tools: ToolDef[]; maxTokens: number; timeoutMs: number },
): Promise<Step> {
  if (conn.provider === "openai") {
    const r = await post(conn, "https://api.openai.com/v1/responses", {
      model: conn.model,
      instructions: input.instructions,
      input: input.items,
      tools: input.tools,
      parallel_tool_calls: false,
      store: false,
      max_output_tokens: input.maxTokens,
    }, input.timeoutMs) as {
      status?: string
      output?: { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string }[] }[]
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    const output = r.output ?? []
    input.items.push(...output)
    return {
      calls: output.filter((o) => o.type === "function_call").map((o) => ({ id: o.call_id ?? "", name: o.name ?? "", arguments: o.arguments ?? "{}" })),
      text: output
        .filter((o) => o.type === "message")
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("\n")
        .trim(),
      usage: { input: n(r.usage?.input_tokens), output: n(r.usage?.output_tokens) },
      incomplete: r.status === "incomplete",
    }
  }

  if (conn.provider === "anthropic") {
    const r = await post(conn, `${ANTHROPIC}/messages`, {
      model: conn.model,
      max_tokens: input.maxTokens + THINKING_HEADROOM,
      system: input.instructions,
      messages: input.items,
      tools: input.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
    }, input.timeoutMs) as AnthropicResponse
    const content = r.content ?? []
    // El turno completo (con sus bloques de razonamiento) vuelve tal cual en la siguiente petición.
    input.items.push({ role: "assistant", content })
    if (r.stop_reason === "refusal") throw new LLMError("refusal", "El modelo se negó a continuar con esta ejecución.")
    return {
      calls: content.filter((b) => b.type === "tool_use").map((b) => ({ id: b.id ?? "", name: b.name ?? "", arguments: JSON.stringify(b.input ?? {}) })),
      text: content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim(),
      usage: anthropicUsage(r),
      incomplete: r.stop_reason === "max_tokens",
    }
  }

  const r = await post(conn, `${CHAT_BASE[conn.provider]}/chat/completions`, {
    model: conn.model,
    messages: [{ role: "system", content: input.instructions }, ...input.items],
    tools: input.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters, ...(conn.provider === "kimi" ? { strict: false } : {}) },
    })),
    ...chatLimits(conn, input.maxTokens),
    ...chatEffort(conn, undefined),
    // Kimi K2.6 solo conserva el razonamiento anterior si se le pide.
    ...(conn.model === "kimi-k2.6" ? { thinking: { type: "enabled", keep: "all" } } : {}),
  }, input.timeoutMs) as ChatResponse
  const choice = r.choices?.[0]
  const msg = choice?.message ?? {}
  // DeepSeek y Kimi exigen recibir de vuelta reasoning_content en los pasos siguientes.
  input.items.push({
    role: "assistant",
    content: msg.content ?? "",
    ...(msg.reasoning_content ? { reasoning_content: msg.reasoning_content } : {}),
    ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}),
  })
  if (choice?.finish_reason === "content_filter") throw new LLMError("refusal", "El modelo se negó a continuar con esta ejecución.")
  return {
    calls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function?.name ?? "", arguments: c.function?.arguments ?? "{}" })),
    text: (msg.content ?? "").trim(),
    usage: { input: n(r.usage?.prompt_tokens), output: n(r.usage?.completion_tokens) },
    incomplete: choice?.finish_reason === "length",
  }
}

// Añade el resultado de una herramienta al historial, en el formato del proveedor.
export function pushToolResult(provider: Provider, items: unknown[], callId: string, output: string) {
  if (provider === "openai") {
    items.push({ type: "function_call_output", call_id: callId, output })
    return
  }
  if (provider === "anthropic") {
    const block = { type: "tool_result", tool_use_id: callId, content: output }
    const last = items[items.length - 1] as { role?: string; content?: unknown } | undefined
    // Todos los resultados de un turno van juntos en el mismo mensaje del usuario.
    if (last?.role === "user" && Array.isArray(last.content) && last.content.every((b) => (b as { type?: string }).type === "tool_result")) {
      last.content.push(block)
    } else {
      items.push({ role: "user", content: [block] })
    }
    return
  }
  items.push({ role: "tool", tool_call_id: callId, content: output })
}

// Un elemento que no puede abrir el historial (un resultado sin su llamada).
export function isToolResult(item: unknown): boolean {
  const i = item as { type?: string; role?: string; content?: unknown } | null
  if (!i) return false
  if (i.type === "function_call_output" || i.role === "tool") return true
  return i.role === "user" && Array.isArray(i.content) && i.content.some((b) => (b as { type?: string }).type === "tool_result")
}
