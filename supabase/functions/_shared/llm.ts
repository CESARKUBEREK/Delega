// Capa común para los proveedores de IA (BYOK): OpenAI (Responses API),
// Anthropic (Messages API) y DeepSeek (Chat Completions, formato OpenAI).
//
// - Conversación en un formato neutro (Msg). Cada adaptador la traduce al de su
//   proveedor y guarda en `native` lo que devolvió, para reenviarlo tal cual en
//   la siguiente vuelta de la misma ejecución (cada ejecución usa un solo modelo).
// - La clave del espacio se descifra solo en memoria; nunca se registra.
// - Errores normalizados en LlmError; una clave rechazada se marca como inválida.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

export type Provider = "openai" | "anthropic" | "deepseek"
export const PROVIDERS: Provider[] = ["openai", "anthropic", "deepseek"]
export const PROVIDER_LABEL: Record<Provider, string> = { openai: "OpenAI", anthropic: "Anthropic", deepseek: "DeepSeek" }

export const AI_MODELS: Record<Provider, string[]> = {
  openai: ["gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna"],
  anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
  deepseek: ["deepseek-flash", "deepseek-v4-pro"],
}
export const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-6.1-sol",
  anthropic: "claude-sonnet-5-5",
  deepseek: "deepseek-flash",
}

export function isProvider(v: unknown): v is Provider {
  return typeof v === "string" && (PROVIDERS as string[]).includes(v)
}

export function providerOf(model: string | null | undefined): Provider | null {
  if (!model) return null
  for (const p of PROVIDERS) if (AI_MODELS[p].includes(model)) return p
  return null
}

export type Ai = { provider: Provider; model: string; apiKey: string }

export class LlmError extends Error {
  constructor(public code: "no_connection" | "invalid_key" | "limit" | "timeout" | "provider" | "refusal" | "bad_output" | "incomplete", message: string) {
    super(message)
  }
}

// Conexión que toca usar: la del modelo pedido (si su proveedor está conectado
// y activo), si no la principal del espacio, y si no cualquiera activa.
export async function resolveAi(admin: SupabaseClient, workspaceId: string, preferredModel?: string | null): Promise<Ai | null> {
  const { data: rows } = await admin
    .from("ai_connections")
    .select("provider, model, status, is_default, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at")
  const active = (rows ?? []).filter((r) => r.status === "active" && isProvider(r.provider))
  const wanted = providerOf(preferredModel)
  const pick = (wanted && active.find((r) => r.provider === wanted)) || active.find((r) => r.is_default) || active[0]
  if (!pick) return null
  const provider = pick.provider as Provider
  const { data: secretRows } = await admin.rpc("ai_connection_secret", { p_workspace_id: workspaceId, p_provider: provider })
  const secret = secretRows?.[0] as { api_key: string; status: string } | undefined
  if (!secret || secret.status !== "active") return null
  const model = wanted === provider && preferredModel ? preferredModel : AI_MODELS[provider].includes(pick.model) ? pick.model : DEFAULT_MODELS[provider]
  return { provider, model, apiKey: secret.api_key }
}

// Mensaje claro cuando no hay ninguna IA conectada.
export const NO_AI_MESSAGE = "Conecta una IA (OpenAI, Anthropic o DeepSeek) en Integraciones."

// ---------------------------------------------------------------------------
// Formato neutro
// ---------------------------------------------------------------------------
export type ToolCall = { id: string; name: string; arguments: string }
export type AssistantMsg = { role: "assistant"; content: string; calls: ToolCall[]; native?: unknown }
export type Msg =
  | { role: "user"; content: string }
  | AssistantMsg
  | { role: "tool"; call_id: string; content: string }
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> }
export type Usage = { input: number; output: number }
export type Completion = { message: AssistantMsg; usage: Usage; stop: "end" | "tool" | "length" | "refusal" }

type Request = {
  instructions: string
  messages: Msg[]
  tools?: ToolDef[]
  schema?: { name: string; schema: Record<string, unknown> }
  maxTokens: number
  timeoutMs: number
}

const int = (v: unknown) => Math.max(0, Math.trunc(Number(v) || 0))

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number, provider: Provider): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.max(5_000, timeoutMs)),
    })
  } catch {
    throw new LlmError("timeout", `${PROVIDER_LABEL[provider]} tardó demasiado en responder. Inténtalo de nuevo.`)
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.ok) return data
  const detail = JSON.stringify(data.error ?? data).toLowerCase()
  if (res.status === 401 || (res.status === 403 && provider !== "anthropic")) {
    throw new LlmError("invalid_key", `${PROVIDER_LABEL[provider]} ha rechazado la clave de este espacio. Actualízala en Integraciones.`)
  }
  if (res.status === 402 || res.status === 429 || detail.includes("credit balance") || detail.includes("insufficient")) {
    throw new LlmError("limit", `Tu cuenta de ${PROVIDER_LABEL[provider]} ha llegado a su límite o no tiene saldo.`)
  }
  console.error("llm", provider, res.status)
  throw new LlmError("provider", `${PROVIDER_LABEL[provider]} no pudo procesar la petición. Inténtalo en unos minutos.`)
}

// ---------------------------------------------------------------------------
// OpenAI (Responses API)
// ---------------------------------------------------------------------------
type OaItem = { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string; refusal?: string }[] }

async function openai(ai: Ai, r: Request): Promise<Completion> {
  const input: unknown[] = []
  for (const m of r.messages) {
    if (m.role === "user") input.push({ role: "user", content: m.content })
    else if (m.role === "tool") input.push({ type: "function_call_output", call_id: m.call_id, output: m.content })
    else if (Array.isArray(m.native)) input.push(...m.native)
    else {
      if (m.content) input.push({ role: "assistant", content: m.content })
      for (const c of m.calls) input.push({ type: "function_call", call_id: c.id, name: c.name, arguments: c.arguments })
    }
  }
  const data = await post(
    "https://api.openai.com/v1/responses",
    { Authorization: `Bearer ${ai.apiKey}` },
    {
      model: ai.model,
      instructions: r.instructions,
      input,
      store: false,
      max_output_tokens: r.maxTokens,
      ...(r.tools?.length
        ? { tools: r.tools.map((t) => ({ type: "function", name: t.name, description: t.description, strict: true, parameters: t.parameters })), parallel_tool_calls: false }
        : {}),
      ...(r.schema ? { text: { format: { type: "json_schema", name: r.schema.name, schema: r.schema.schema, strict: true } } } : {}),
    },
    r.timeoutMs,
    "openai",
  )
  const output = (data.output ?? []) as OaItem[]
  const parts = output.filter((o) => o.type === "message").flatMap((o) => o.content ?? [])
  const refusal = parts.some((c) => c.type === "refusal")
  const content = parts.filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("\n").trim()
  const calls = output.filter((o) => o.type === "function_call").map((o) => ({ id: o.call_id ?? "", name: o.name ?? "", arguments: o.arguments ?? "{}" }))
  const usage = (data.usage ?? {}) as Record<string, unknown>
  return {
    message: { role: "assistant", content, calls, native: output },
    usage: { input: int(usage.input_tokens), output: int(usage.output_tokens) },
    stop: refusal ? "refusal" : calls.length ? "tool" : data.status === "incomplete" ? "length" : "end",
  }
}

// ---------------------------------------------------------------------------
// Anthropic (Messages API)
// ---------------------------------------------------------------------------
type AnBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown }

async function anthropic(ai: Ai, r: Request): Promise<Completion> {
  const messages: { role: "user" | "assistant"; content: unknown[] }[] = []
  const push = (role: "user" | "assistant", blocks: unknown[]) => {
    const last = messages[messages.length - 1]
    // La API espera turnos alternos: se juntan los consecutivos del mismo rol.
    if (last && last.role === role) last.content.push(...blocks)
    else messages.push({ role, content: blocks })
  }
  for (const m of r.messages) {
    if (m.role === "user") push("user", [{ type: "text", text: m.content || "(vacío)" }])
    else if (m.role === "tool") push("user", [{ type: "tool_result", tool_use_id: m.call_id, content: m.content }])
    else if (Array.isArray(m.native)) push("assistant", m.native)
    else {
      const blocks: unknown[] = []
      if (m.content) blocks.push({ type: "text", text: m.content })
      for (const c of m.calls) {
        let input: unknown = {}
        try {
          input = JSON.parse(c.arguments || "{}")
        } catch {
          input = {}
        }
        blocks.push({ type: "tool_use", id: c.id, name: c.name, input })
      }
      if (blocks.length) push("assistant", blocks)
    }
  }
  // La conversación tiene que empezar por el usuario.
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: [{ type: "text", text: "(Conversación anterior)" }] })
  const data = await post(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": ai.apiKey, "anthropic-version": "2023-06-01" },
    {
      model: ai.model,
      max_tokens: r.maxTokens,
      system: r.instructions,
      messages,
      ...(r.tools?.length
        ? {
          tools: r.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
          tool_choice: { type: "auto", disable_parallel_tool_use: true },
        }
        : {}),
      ...(r.schema ? { output_config: { format: { type: "json_schema", schema: r.schema.schema } } } : {}),
    },
    r.timeoutMs,
    "anthropic",
  )
  const blocks = (data.content ?? []) as AnBlock[]
  const content = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim()
  const calls = blocks
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id ?? "", name: b.name ?? "", arguments: JSON.stringify(b.input ?? {}) }))
  const usage = (data.usage ?? {}) as Record<string, unknown>
  const reason = data.stop_reason
  return {
    message: { role: "assistant", content, calls, native: blocks },
    usage: { input: int(usage.input_tokens) + int(usage.cache_read_input_tokens) + int(usage.cache_creation_input_tokens), output: int(usage.output_tokens) },
    stop: reason === "refusal" ? "refusal" : calls.length ? "tool" : reason === "max_tokens" ? "length" : "end",
  }
}

// ---------------------------------------------------------------------------
// DeepSeek (Chat Completions)
// ---------------------------------------------------------------------------
type DsChoice = {
  finish_reason?: string
  message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }
}

async function deepseek(ai: Ai, r: Request): Promise<Completion> {
  // Sin JSON Schema estricto: se pide un objeto JSON y el esquema va en las instrucciones.
  const system = r.schema
    ? `${r.instructions}\n\nResponde SOLO con un objeto JSON válido (json) que cumpla este JSON Schema, sin texto alrededor:\n${JSON.stringify(r.schema.schema)}`
    : r.instructions
  const messages: unknown[] = [{ role: "system", content: system }]
  for (const m of r.messages) {
    if (m.role === "user") messages.push({ role: "user", content: m.content })
    else if (m.role === "tool") messages.push({ role: "tool", tool_call_id: m.call_id, content: m.content })
    else {
      messages.push({
        role: "assistant",
        content: m.content || null,
        ...(m.calls.length
          ? { tool_calls: m.calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments } })) }
          : {}),
      })
    }
  }
  const data = await post(
    "https://api.deepseek.com/chat/completions",
    { Authorization: `Bearer ${ai.apiKey}` },
    {
      model: ai.model,
      messages,
      max_tokens: r.maxTokens,
      // Sin modo de razonamiento: respuestas más rápidas y sin tener que reenviar el razonamiento.
      thinking: { type: "disabled" },
      ...(r.tools?.length
        ? { tools: r.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })) }
        : {}),
      ...(r.schema ? { response_format: { type: "json_object" } } : {}),
      stream: false,
    },
    r.timeoutMs,
    "deepseek",
  )
  const choice = ((data.choices ?? []) as DsChoice[])[0] ?? {}
  const calls = (choice.message?.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, arguments: c.function.arguments || "{}" }))
  const usage = (data.usage ?? {}) as Record<string, unknown>
  return {
    message: { role: "assistant", content: (choice.message?.content ?? "").trim(), calls },
    usage: { input: int(usage.prompt_tokens), output: int(usage.completion_tokens) },
    stop: calls.length ? "tool" : choice.finish_reason === "length" ? "length" : choice.finish_reason === "content_filter" ? "refusal" : "end",
  }
}

// ---------------------------------------------------------------------------
// Puntos de entrada
// ---------------------------------------------------------------------------
export async function complete(ai: Ai, r: Request): Promise<Completion> {
  if (ai.provider === "anthropic") return anthropic(ai, r)
  if (ai.provider === "deepseek") return deepseek(ai, r)
  return openai(ai, r)
}

// Respuesta con forma fija (JSON Schema). Devuelve el objeto ya parseado.
export async function generateJson<T>(
  ai: Ai,
  r: { instructions: string; messages: Msg[]; name: string; schema: Record<string, unknown>; maxTokens: number; timeoutMs: number },
): Promise<{ data: T; usage: Usage }> {
  const res = await complete(ai, { instructions: r.instructions, messages: r.messages, schema: { name: r.name, schema: r.schema }, maxTokens: r.maxTokens, timeoutMs: r.timeoutMs })
  if (res.stop === "refusal") throw new LlmError("refusal", "No puedo ayudar con esa petición.")
  if (res.stop === "length") throw new LlmError("incomplete", "La respuesta quedó incompleta. Prueba con una petición más concreta.")
  const text = res.message.content.replace(/^```(?:json)?\s*|\s*```$/g, "")
  try {
    return { data: JSON.parse(text) as T, usage: res.usage }
  } catch {
    throw new LlmError("bad_output", "La respuesta de la IA no tenía el formato esperado. Inténtalo de nuevo.")
  }
}

export async function generateText(ai: Ai, r: { instructions: string; messages: Msg[]; maxTokens: number; timeoutMs: number }): Promise<{ text: string; usage: Usage }> {
  const res = await complete(ai, r)
  if (res.stop === "refusal") throw new LlmError("refusal", "No puedo ayudar con esa petición.")
  return { text: res.message.content, usage: res.usage }
}

// Registra el consumo y, si la clave fue rechazada, la marca como inválida.
export async function recordUsage(
  admin: SupabaseClient,
  ai: Ai,
  usage: Usage,
  extra: { workspaceId: string; userId: string | null; conversationId?: string | null },
) {
  await admin.from("usage_events").insert({
    workspace_id: extra.workspaceId,
    provider: ai.provider,
    model: ai.model,
    input_tokens: usage.input,
    output_tokens: usage.output,
    conversation_id: extra.conversationId ?? null,
    created_by: extra.userId,
  })
}

export async function markInvalidIfNeeded(admin: SupabaseClient, workspaceId: string, ai: Ai, e: unknown) {
  if (e instanceof LlmError && e.code === "invalid_key") {
    await admin.rpc("ai_connection_mark_invalid", { p_workspace_id: workspaceId, p_provider: ai.provider })
  }
}

// Convierte la transcripción antigua de una ejecución (items de la Responses
// API de OpenAI) al formato neutro. Los items del modelo se conservan en
// `native` para reenviarlos tal cual.
export function fromResponsesItems(items: unknown[]): Msg[] {
  const out: Msg[] = []
  let current: AssistantMsg | null = null
  const flush = () => {
    if (current) out.push(current)
    current = null
  }
  for (const raw of items) {
    const it = raw as OaItem & { role?: string; output?: string; content?: unknown }
    if (it.role === "user") {
      flush()
      out.push({ role: "user", content: typeof it.content === "string" ? it.content : JSON.stringify(it.content) })
    } else if (it.type === "function_call_output") {
      flush()
      out.push({ role: "tool", call_id: it.call_id ?? "", content: String(it.output ?? "") })
    } else {
      current ??= { role: "assistant", content: "", calls: [], native: [] }
      ;(current.native as unknown[]).push(raw)
      if (it.type === "function_call") current.calls.push({ id: it.call_id ?? "", name: it.name ?? "", arguments: it.arguments ?? "{}" })
      if (it.type === "message") {
        current.content += (Array.isArray(it.content) ? it.content : []).map((c: { text?: string }) => c.text ?? "").join("")
      }
    }
  }
  flush()
  return out
}
