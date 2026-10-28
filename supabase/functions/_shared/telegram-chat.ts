// Chat propio con MarchaSolo por Telegram. Cuando escribe al bot del espacio una
// persona que vinculó ese chat privado (Configuración → Mis avisos), el
// mensaje no va a la bandeja: es una orden suya.
//
// - Texto o nota de voz: el agente lo atiende con sus permisos (como si lo
//   lanzara desde la app) y la respuesta vuelve al chat al terminar. Lo que
//   escriba o envíe espera aprobación, que puede dar con los botones.
// - Comandos: /pendientes, /automatizaciones, /resumen, /nuevo, /ayuda.
// - Botones: aprobar o rechazar (caducan a las 24 h y valen para una acción
//   concreta), lanzar, pausar o reactivar una automatización.
//
// Cualquier otro chat sigue como antes (bandeja y automatizaciones).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { advance, claim, createRun, proposalTitle, type RunRow } from "./agent.ts"
import { isUuid, isWorkspaceAdmin } from "./core.ts"
import { decideRun } from "./decide.ts"
import { NO_AI_MESSAGE, resolveAi } from "./llm.ts"
import { answerCallback, downloadTelegramFile, editTelegram, type InlineKeyboard, sendTelegram, sendTyping, TelegramError } from "./telegram.ts"
import { actionKey, APPROVAL_TTL_MS, approvableFromTelegram, approvalMessage } from "./telegram-notice.ts"
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, transcribe, TranscribeError } from "./transcribe.ts"

export const MAX_REQUESTS_PER_HOUR = 30
const CONTEXT_RUNS = 3
const CONTEXT_WINDOW_MS = 60 * 60_000
const SLICE_MS = 60_000

export type TgMessage = {
  message_id?: number
  date?: number
  chat?: { id?: number; type?: string }
  from?: { id?: number; is_bot?: boolean }
  text?: string
  caption?: string
  voice?: { file_id?: string; duration?: number; mime_type?: string; file_size?: number }
  audio?: { file_id?: string; duration?: number; mime_type?: string; file_size?: number }
}
export type TgCallback = {
  id: string
  from?: { id?: number }
  data?: string
  message?: { message_id?: number; date?: number; text?: string; chat?: { id?: number; type?: string } }
}

const HELP = [
  "Soy MarchaSolo. Escríbeme o mándame una nota de voz con lo que necesites, por ejemplo:",
  "• ¿Qué tengo mañana?",
  "• Busca el último correo de García y prepárale una respuesta",
  "• Crea en HubSpot el contacto de Ana López, ana@ejemplo.com",
  "",
  "Lo que haya que enviar o cambiar te lo enseño antes, con botones para aprobarlo.",
  "",
  "Comandos:",
  "/pendientes — lo que espera tu aprobación",
  "/automatizaciones — lanzar, pausar o reactivar tus automatizaciones",
  "/resumen — el resumen de la mañana, ahora",
  "/nuevo — empezar una conversación nueva",
].join("\n")

const PLAN = (text: string) => ({
  version: 1,
  name: "Petición por Telegram",
  summary: text.slice(0, 200),
  trigger: { type: "manual", description: "Mensaje en tu chat de Telegram" },
  connections: [],
  steps: [{ id: "s1", kind: "generate", title: "Atender la petición", description: "Lo que pide el usuario en su mensaje.", connection: "none", requires_approval: false }],
  open_questions: [],
})

// Persona dueña de este chat privado en el espacio (miembro activo), o null.
export async function chatOwner(admin: SupabaseClient, workspaceId: string, chatId: string): Promise<string | null> {
  const { data } = await admin
    .from("user_channels")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("telegram_chat_id", chatId)
    .limit(2)
  if (data?.length !== 1) return null
  const { data: m } = await admin
    .from("memberships")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", data[0].user_id)
    .eq("status", "active")
    .maybeSingle()
  return m ? data[0].user_id : null
}

function reply(token: string, chatId: string, text: string, keyboard?: InlineKeyboard) {
  return sendTelegram(token, chatId, text, keyboard).catch((e) => {
    console.error("telegram-chat reply", e instanceof Error ? e.name : "error")
    return 0
  })
}

// ---------------------------------------------------------------------------
// Mensajes
// ---------------------------------------------------------------------------
export async function handleOwnerMessage(admin: SupabaseClient, workspaceId: string, token: string, userId: string, m: TgMessage) {
  const chatId = String(m.chat!.id)
  const raw = (m.text ?? m.caption ?? "").trim()

  const cmd = raw.match(/^\/([a-záéíóúñ]+)(?:@\w+)?(?:\s|$)/i)?.[1]?.toLowerCase()
  if (cmd) {
    if (cmd === "pendientes") return listPending(admin, workspaceId, token, userId, chatId)
    if (cmd === "automatizaciones" || cmd === "flujos") return listFlows(admin, workspaceId, token, userId, chatId)
    if (cmd === "resumen") return launchSummary(admin, workspaceId, token, userId, chatId, m.message_id!)
    if (cmd === "nuevo") {
      await admin.from("user_channels").update({ telegram_chat_since: new Date().toISOString() }).eq("workspace_id", workspaceId).eq("user_id", userId)
      return reply(token, chatId, "Vale, empezamos de cero. ¿Qué necesitas?")
    }
    return reply(token, chatId, HELP)
  }

  let text = raw
  let voice = false
  const audio = m.voice ?? m.audio
  if (!text && audio?.file_id) {
    if ((audio.duration ?? 0) > MAX_AUDIO_SECONDS) return reply(token, chatId, "La nota de voz es muy larga. Prueba con menos de dos minutos y medio.")
    if ((audio.file_size ?? 0) > MAX_AUDIO_BYTES) return reply(token, chatId, "La nota de voz es demasiado grande.")
    if (await overLimit(admin, workspaceId, userId)) return reply(token, chatId, "Has hecho muchas peticiones en la última hora. Espera un poco.")
    await sendTyping(token, chatId).catch(() => undefined)
    try {
      const bytes = await downloadTelegramFile(token, audio.file_id, MAX_AUDIO_BYTES)
      text = await transcribe(admin, {
        workspaceId,
        userId,
        bytes,
        filename: m.voice ? "nota.ogg" : "audio.mp3",
        type: m.voice ? "audio/ogg" : (audio.mime_type ?? "audio/mpeg"),
        seconds: audio.duration ?? 0,
      })
    } catch (e) {
      return reply(token, chatId, e instanceof TranscribeError || e instanceof TelegramError ? e.message : "No he podido escuchar la nota de voz.")
    }
    if (!text) return reply(token, chatId, "No he entendido la nota de voz. ¿Puedes repetirla o escribirlo?")
    voice = true
    await reply(token, chatId, `🎙️ «${text.length > 500 ? `${text.slice(0, 499)}…` : text}»`)
  }
  if (!text) return reply(token, chatId, "De momento entiendo texto y notas de voz. Escribe /ayuda para ver ejemplos.")

  return ask(admin, workspaceId, token, userId, chatId, m.message_id!, text, voice)
}

async function overLimit(admin: SupabaseClient, workspaceId: string, userId: string): Promise<boolean> {
  const { count } = await admin
    .from("flow_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("started_by", userId)
    .eq("trigger->>type", "telegram_chat")
    .gte("started_at", new Date(Date.now() - 3_600_000).toISOString())
  return (count ?? 0) >= MAX_REQUESTS_PER_HOUR
}

// Últimos intercambios por Telegram (para que «y el de mañana?» se entienda).
async function recentContext(admin: SupabaseClient, workspaceId: string, userId: string): Promise<string> {
  const { data: ch } = await admin.from("user_channels").select("telegram_chat_since").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle()
  const since = Math.max(Date.now() - CONTEXT_WINDOW_MS, ch?.telegram_chat_since ? Date.parse(ch.telegram_chat_since) : 0)
  const { data: runs } = await admin
    .from("flow_runs")
    .select("trigger, status, summary, error")
    .eq("workspace_id", workspaceId)
    .eq("started_by", userId)
    .eq("trigger->>type", "telegram_chat")
    .gte("started_at", new Date(since).toISOString())
    .in("status", ["succeeded", "failed"])
    .order("started_at", { ascending: false })
    .limit(CONTEXT_RUNS)
  if (!runs?.length) return ""
  const lines = runs.reverse().map((r) => {
    const asked = String((r.trigger as { text?: string }).text ?? "").slice(0, 600)
    const answered = String((r.status === "succeeded" ? r.summary : r.error) ?? "").slice(0, 1200)
    return `Usuario: ${asked}\nMarchaSolo: ${answered}`
  })
  return `Conversación reciente en Telegram (contexto; lo nuevo es el mensaje de arriba):\n${lines.join("\n\n")}`
}

async function startRun(
  admin: SupabaseClient,
  workspaceId: string,
  token: string,
  userId: string,
  chatId: string,
  messageId: number,
  input: { text: string; voice?: boolean; flow?: { id: string; name: string; definition: unknown; settings: unknown } },
) {
  if (await overLimit(admin, workspaceId, userId)) return reply(token, chatId, "Has hecho muchas peticiones en la última hora. Espera un poco.")
  const settings = (input.flow?.settings ?? {}) as { file_ids?: unknown; model?: unknown }
  const ai = await resolveAi(admin, workspaceId, typeof settings.model === "string" ? settings.model : null)
  if (!ai) return reply(token, chatId, NO_AI_MESSAGE)

  let fileIds: string[]
  if (input.flow) {
    fileIds = Array.isArray(settings.file_ids) ? settings.file_ids.filter(isUuid).slice(0, 5) : []
  } else {
    const { data: files } = await admin.from("integration_files").select("id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(5)
    fileIds = (files ?? []).map((f) => f.id)
  }

  await sendTyping(token, chatId).catch(() => undefined)
  let run: RunRow
  try {
    run = await createRun(admin, {
      workspaceId,
      flow: input.flow ?? { id: null, name: "Petición por Telegram", definition: PLAN(input.text) },
      fileIds,
      note: input.flow ? "" : await recentContext(admin, workspaceId, userId),
      model: ai.model,
      startedBy: userId,
      trigger: { type: "telegram_chat", chat_id: chatId, message_id: messageId, text: input.text.slice(0, 4000), ...(input.voice ? { voice: true } : {}) },
    })
  } catch {
    return reply(token, chatId, "No he podido empezar. Inténtalo de nuevo en un momento.")
  }
  const claimed = await claim(admin, run.id, "running")
  if (!claimed) return
  const status = await advance(admin, claimed, SLICE_MS)
  // Si no ha terminado, sigue runs-cron y la respuesta llega al acabar.
  if (status === "running") await reply(token, chatId, "Sigo con ello; te escribo al terminar.")
}

function ask(admin: SupabaseClient, workspaceId: string, token: string, userId: string, chatId: string, messageId: number, text: string, voice: boolean) {
  return startRun(admin, workspaceId, token, userId, chatId, messageId, { text, voice })
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------
async function listPending(admin: SupabaseClient, workspaceId: string, token: string, userId: string, chatId: string) {
  const isAdmin = await isWorkspaceAdmin(admin, workspaceId, userId)
  let q = admin
    .from("flow_runs")
    .select("id, flow_name, pending_action, started_by")
    .eq("workspace_id", workspaceId)
    .eq("status", "awaiting_approval")
    .order("updated_at", { ascending: false })
    .limit(6)
  if (!isAdmin) q = q.eq("started_by", userId)
  const { data: runs } = await q
  const list = (runs ?? []).filter((r) => r.pending_action)
  if (!list.length) return reply(token, chatId, "No hay nada esperando tu aprobación. 👌")
  if (list.length > 5) await reply(token, chatId, "Te enseño las 5 más recientes; el resto, en Pendientes de la app.")
  for (const r of list.slice(0, 5)) {
    const pending = r.pending_action as RunRow["pending_action"] & object
    const { text, keyboard } = await approvalMessage(r, pending, proposalTitle(pending))
    await reply(token, chatId, text, keyboard)
  }
}

type FlowRow = { id: string; name: string; status: string; definition: unknown; settings: unknown; created_by: string | null; next_run_at: string | null }

function triggerType(f: { definition: unknown }): string {
  return String((f.definition as { trigger?: { type?: string } } | null)?.trigger?.type ?? "manual")
}

async function listFlows(admin: SupabaseClient, workspaceId: string, token: string, userId: string, chatId: string) {
  const isAdmin = await isWorkspaceAdmin(admin, workspaceId, userId)
  const { data } = await admin
    .from("flows")
    .select("id, name, status, definition, settings, created_by, next_run_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(12)
  const flows = ((data ?? []) as FlowRow[]).filter((f) => isAdmin || f.created_by === userId)
  if (!flows.length) return reply(token, chatId, "Aún no tienes automatizaciones. Créalas en la app, en Automatizaciones.")
  const { data: ws } = await admin.from("workspaces").select("timezone").eq("id", workspaceId).maybeSingle()
  const tz = ws?.timezone ?? "Europe/Madrid"
  const fmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: tz })
  const STATUS: Record<string, string> = { active: "activa", paused: "pausada", draft: "borrador" }
  const lines = flows.map((f) => `• ${f.name} — ${STATUS[f.status] ?? f.status}${f.status === "active" && f.next_run_at ? ` (próxima: ${fmt.format(new Date(f.next_run_at))})` : ""}`)
  const keyboard: InlineKeyboard = []
  for (const f of flows) {
    const row = []
    if (launchable(f)) row.push({ text: `▶️ ${f.name.slice(0, 28)}`, callback_data: `run:${f.id}` })
    if (f.status === "active") row.push({ text: "⏸ Pausar", callback_data: `pause:${f.id}` })
    if (f.status === "paused") row.push({ text: "🔁 Activar", callback_data: `resume:${f.id}` })
    if (row.length) keyboard.push(row)
  }
  return reply(token, chatId, `Tus automatizaciones:\n${lines.join("\n")}\n\n▶️ la lanza ahora; el resultado te llega aquí.`, keyboard)
}

// Las que arrancan con un correo o un mensaje necesitan ese correo o mensaje.
function launchable(f: { definition: unknown }): boolean {
  return !["email_message", "telegram_message"].includes(triggerType(f))
}

function launchFlow(admin: SupabaseClient, workspaceId: string, token: string, userId: string, chatId: string, messageId: number, f: FlowRow) {
  return startRun(admin, workspaceId, token, userId, chatId, messageId, {
    text: `Ejecuta ahora la automatización «${f.name}» siguiendo su plan. Si el plan dice avisarme, tu resumen final ya me llega aquí.`,
    flow: f,
  })
}

async function launchSummary(admin: SupabaseClient, workspaceId: string, token: string, userId: string, chatId: string, messageId: number) {
  const { data } = await admin
    .from("flows")
    .select("id, name, status, definition, settings, created_by, next_run_at")
    .eq("workspace_id", workspaceId)
    .ilike("name", "%resumen%")
    .order("updated_at", { ascending: false })
    .limit(5)
  const isAdmin = await isWorkspaceAdmin(admin, workspaceId, userId)
  const flows = ((data ?? []) as FlowRow[]).filter((f) => (isAdmin || f.created_by === userId) && launchable(f))
  const f = flows.find((x) => /mañana/i.test(x.name)) ?? flows[0]
  if (!f) {
    return reply(token, chatId, "No tienes una automatización de resumen. Créala en la app con la plantilla «Resumen de la mañana», o pídemelo con tus palabras.")
  }
  await reply(token, chatId, `Preparando «${f.name}»…`)
  return launchFlow(admin, workspaceId, token, userId, chatId, messageId, f)
}

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------
export async function handleCallback(admin: SupabaseClient, workspaceId: string, token: string, cq: TgCallback) {
  const msg = cq.message
  const chat = msg?.chat
  const answer = (text?: string) => answerCallback(token, cq.id, text).catch(() => undefined)
  // Solo en el chat privado vinculado y pulsado por esa misma persona.
  if (!chat?.id || chat.type !== "private" || cq.from?.id !== chat.id || !msg?.message_id) return answer("No autorizado.")
  const chatId = String(chat.id)
  const userId = await chatOwner(admin, workspaceId, chatId)
  if (!userId) return answer("Este chat no está vinculado a MarchaSolo.")
  const data = cq.data ?? ""

  const decision = data.match(/^(ap|re):([0-9a-f-]{36}):([0-9a-f]{12})$/)
  if (decision) return handleDecision(admin, workspaceId, token, userId, chatId, msg, decision, answer)

  const flowAction = data.match(/^(run|pause|resume):([0-9a-f-]{36})$/)
  if (!flowAction || !isUuid(flowAction[2])) return answer("Botón no válido.")
  const { data: f } = await admin
    .from("flows")
    .select("id, name, status, definition, settings, created_by, next_run_at")
    .eq("id", flowAction[2])
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  const flow = f as FlowRow | null
  if (!flow) return answer("Esa automatización ya no existe.")
  if (flow.created_by !== userId && !(await isWorkspaceAdmin(admin, workspaceId, userId))) return answer("Solo quien la creó o un administrador puede hacerlo.")

  if (flowAction[1] === "run") {
    if (!launchable(flow)) return answer("Esta arranca sola al llegar un correo o un mensaje.")
    await answer(`Lanzando «${flow.name}»…`)
    return launchFlow(admin, workspaceId, token, userId, chatId, msg.message_id!, flow)
  }
  const next = flowAction[1] === "pause" ? "paused" : "active"
  const from = flowAction[1] === "pause" ? "active" : "paused"
  const { data: updated } = await admin.from("flows").update({ status: next }).eq("id", flow.id).eq("status", from).select("id")
  if (!updated?.length) return answer("Ya estaba así.")
  await answer(next === "paused" ? "Pausada." : "Activada.")
  return reply(token, chatId, next === "paused" ? `⏸ «${flow.name}» pausada.` : `🔁 «${flow.name}» activa de nuevo.`)
}

async function handleDecision(
  admin: SupabaseClient,
  workspaceId: string,
  token: string,
  userId: string,
  chatId: string,
  msg: NonNullable<TgCallback["message"]>,
  match: RegExpMatchArray,
  answer: (text?: string) => Promise<unknown>,
) {
  const [, verb, runId, key] = match
  const approve = verb === "ap"
  const original = msg.text ?? ""
  const close = (line: string) => editTelegram(token, chatId, msg.message_id!, `${original}\n\n${line}`).catch(() => undefined)

  if (!msg.date || msg.date * 1000 < Date.now() - APPROVAL_TTL_MS) {
    await answer("Caducado.")
    return close("⌛ Caducado: decide en la app, en Pendientes.")
  }
  const { data: run } = await admin
    .from("flow_runs")
    .select("id, started_by, status, pending_action")
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .maybeSingle()
  if (!run) return answer("No se encontró la ejecución.")
  if (run.started_by !== userId && !(await isWorkspaceAdmin(admin, workspaceId, userId))) return answer("Solo quien la lanzó o un administrador puede decidir.")
  const pending = run.pending_action as { tool?: string } | null
  if (run.status !== "awaiting_approval" || !pending) {
    await answer("Ya estaba decidido.")
    return close("ℹ️ Ya se decidió (quizá desde la app).")
  }
  if (approve && !approvableFromTelegram(pending.tool ?? "")) return answer("Esta acción solo se aprueba en la app.")

  const result = await decideRun(admin, runId, approve, userId, {
    via: "telegram",
    expectCallId: async (callId) => (await actionKey(callId)) === key,
  })
  if (!result.ok) {
    if (result.code === "busy") return answer("Se está procesando; prueba en unos segundos.")
    await answer("Ya estaba decidido.")
    return close("ℹ️ Ya se decidió (quizá desde la app).")
  }

  let line = approve ? "✅ Aprobado." : "✖️ Rechazado."
  if (approve) {
    const out = (() => {
      try {
        return JSON.parse(result.output) as { ok?: boolean; error?: string }
      } catch {
        return {}
      }
    })()
    if (out.error || out.ok === false) line = `⚠️ Aprobado, pero falló: ${String(out.error ?? "error").slice(0, 300)}`
  }
  await answer(approve ? "Aprobado" : "Rechazado")
  await close(line)

  // La ejecución sigue; si espera otra aprobación o termina, llega aquí.
  const claimed = await claim(admin, runId, "running")
  if (claimed) await advance(admin, claimed, SLICE_MS)
}
