// Diagnóstico sin IA de una ejecución que falló (fase 7-2): a partir del
// mensaje de error (los que escriben el agente y la capa de IA, ya en español)
// dice qué pasó, qué hacer y qué tarjeta abrir. Si la conexión ya vuelve a
// estar activa, lo dice para que se pueda reintentar. Sin dependencias: se
// prueba con tsx.

export type DiagnosisKind = "trial_ended" | "trial_run_cap" | "plan_limit" | "plan_run_cap" | "ai_key" | "ai_balance" | "ai_missing" | "ai_temporary" | "connection" | "too_long" | "too_much_data" | "refused" | "unknown"

export type Diagnosis = {
  kind: DiagnosisKind
  cause: string
  fix: string
  // Ficha de ayuda cuya tarjeta abrir (src/lib/help.ts).
  guide: string | null
  // Si ya se puede volver a ejecutar tal cual.
  retry: boolean
  // Si cambiar las instrucciones de la automatización puede arreglarlo.
  editable: boolean
}

// Qué está conectado ahora mismo (ids de ficha: openai, anthropic, deepseek,
// xai, drive, calendar, contacts, hubspot, buffer, whatsapp, telegram, imap…).
export type LiveStatus = Record<string, boolean>

const AI_GUIDE: [RegExp, string][] = [
  [/openai/i, "openai"],
  [/anthropic|claude/i, "anthropic"],
  [/deepseek/i, "deepseek"],
  [/grok|xai/i, "xai"],
]
const CONNECTION_GUIDE: [RegExp, string, string][] = [
  [/google contacts/i, "contacts", "Google Contacts"],
  [/google calendar|calendario/i, "calendar", "Google Calendar"],
  [/google/i, "drive", "Google Drive"],
  [/hubspot/i, "hubspot", "HubSpot"],
  [/buffer/i, "buffer", "Buffer"],
  [/whatsapp/i, "whatsapp", "WhatsApp"],
  [/telegram/i, "telegram", "Telegram"],
  [/tokko/i, "tokko", "Tokko"],
  [/xubio/i, "xubio", "Xubio"],
  [/correo|smtp|imap/i, "imap", "el correo"],
]

const aiGuide = (text: string) => AI_GUIDE.find(([re]) => re.test(text))?.[1] ?? "openai"

export function diagnoseRun(error: string | null | undefined, live: LiveStatus = {}): Diagnosis {
  const e = (error ?? "").trim()

  // Prueba gratuita (1 $, decisión del 7 nov).
  if (/prueba gratuita ha terminado/i.test(e)) {
    const anyAi = ["openai", "anthropic", "deepseek", "xai"].some((g) => live[g])
    return anyAi
      ? { kind: "trial_ended", cause: "Se terminó la prueba gratuita de MarchaSolo.", fix: "Ya tienes tu IA conectada: puedes ejecutarla otra vez.", guide: null, retry: true, editable: false }
      : { kind: "trial_ended", cause: "Se terminó la prueba gratuita de MarchaSolo.", fix: "Elige un plan para que tus automatizaciones sigan funcionando con la IA incluida, o conecta tu propia IA en Integraciones.", guide: "openai", retry: false, editable: false }
  }
  if (/m[aá]ximo de la prueba gratuita por ejecuci[oó]n/i.test(e)) {
    return { kind: "trial_run_cap", cause: "La ejecución llegó al máximo de gasto de la prueba gratuita por ejecución.", fix: "Vuelve a lanzarla o haz la tarea más concreta. Con tu IA conectada no hay este límite.", guide: null, retry: true, editable: true }
  }
  // IA incluida en el plan (decisión del 11 nov): cupo del mes o máximo por ejecución.
  if (/l[ií]mite de tareas de tu plan/i.test(e)) {
    return { kind: "plan_limit", cause: "Se terminaron las tareas de tu plan este mes.", fix: "Se renuevan con el próximo periodo. Si no quieres esperar, conecta tu propia IA en Integraciones y sigue sin límite.", guide: "openai", retry: false, editable: false }
  }
  if (/m[aá]ximo por ejecuci[oó]n de la IA incluida/i.test(e)) {
    return { kind: "plan_run_cap", cause: "La ejecución llegó al máximo de gasto por ejecución de la IA incluida.", fix: "Vuelve a lanzarla o haz la tarea más concreta. Con tu propia IA no hay este límite.", guide: null, retry: true, editable: true }
  }
  if (/rechazado la clave/i.test(e)) {
    const g = aiGuide(e)
    return live[g]
      ? { kind: "ai_key", cause: "La clave de la IA dejó de funcionar.", fix: "Ya la has vuelto a conectar: puedes ejecutarla otra vez.", guide: null, retry: true, editable: false }
      : { kind: "ai_key", cause: "La IA rechazó la clave de este espacio (la borraron, caducó o cambió).", fix: "Crea una clave nueva en tu cuenta del proveedor y pégala en su tarjeta de Integraciones. Después, vuelve a ejecutarla.", guide: g, retry: false, editable: false }
  }
  if (/l[ií]mite o no tiene saldo/i.test(e)) {
    return { kind: "ai_balance", cause: "Tu cuenta de la IA se quedó sin saldo o llegó a su límite de gasto.", fix: "Añade saldo o sube el límite en la web del proveedor y vuelve a ejecutarla.", guide: aiGuide(e), retry: true, editable: false }
  }
  if (/conecta una ia/i.test(e)) {
    const anyAi = ["openai", "anthropic", "deepseek", "xai"].some((g) => live[g])
    return anyAi
      ? { kind: "ai_missing", cause: "Cuando se ejecutó no había ninguna IA conectada.", fix: "Ya tienes una IA conectada: puedes ejecutarla otra vez.", guide: null, retry: true, editable: false }
      : { kind: "ai_missing", cause: "No hay ninguna IA conectada en este espacio (las ejecuciones necesitan una IA propia).", fix: "Conecta la clave de OpenAI, Anthropic, DeepSeek o Grok en Integraciones.", guide: "openai", retry: false, editable: false }
  }
  if (/tard[oó] demasiado|no pudo procesar la petici[oó]n|formato esperado/i.test(e)) {
    return { kind: "ai_temporary", cause: "La IA tuvo un fallo pasajero (estaba saturada o tardó demasiado).", fix: "No tienes que cambiar nada: vuelve a ejecutarla en unos minutos.", guide: null, retry: true, editable: false }
  }
  if (/qued[oó] incompleta/i.test(e)) {
    return { kind: "too_long", cause: "La respuesta de la IA era demasiado larga y se cortó.", fix: "Haz la tarea más concreta: menos pasos o pasos más cortos.", guide: null, retry: false, editable: true }
  }
  if (/l[ií]mite de \d+ acciones/i.test(e)) {
    return { kind: "too_long", cause: "El agente dio demasiadas vueltas sin terminar.", fix: "Suele pasar cuando un paso es ambiguo. Concreta qué hay que leer y qué resultado esperas, o divide la automatización en dos.", guide: null, retry: false, editable: true }
  }
  if (/demasiados datos/i.test(e)) {
    return { kind: "too_much_data", cause: "La ejecución leyó demasiados datos de una vez.", fix: "Pide rangos más pequeños de la planilla (por ejemplo, solo las filas de este mes) o documentos más cortos.", guide: null, retry: false, editable: true }
  }
  if (/no puedo ayudar con esa petici[oó]n/i.test(e)) {
    return { kind: "refused", cause: "La IA se negó a hacer la tarea tal como estaba escrita.", fix: "Reescribe los pasos de forma más concreta y neutra.", guide: null, retry: false, editable: true }
  }
  const conn = CONNECTION_GUIDE.find(([re]) => re.test(e))
  if (conn && /(no est[aá] (activa|conectad)|retirado el acceso|obtener acceso|desconect)/i.test(e)) {
    const [, g, label] = conn
    return live[g]
      ? { kind: "connection", cause: `${label} no estaba conectado cuando se ejecutó.`, fix: "Ya vuelve a estar conectado: puedes ejecutarla otra vez.", guide: null, retry: true, editable: false }
      : { kind: "connection", cause: `${label} no está conectado o retiró el acceso.`, fix: `Vuelve a conectar ${label} en Integraciones y ejecútala otra vez.`, guide: g, retry: false, editable: false }
  }
  if (/google/i.test(e)) {
    return { kind: "connection", cause: "Hubo un problema al acceder a Google.", fix: "Comprueba la conexión de Google Drive en Integraciones y vuelve a intentarlo.", guide: "drive", retry: true, editable: false }
  }
  return {
    kind: "unknown",
    cause: e ? "La ejecución se paró con este error." : "La ejecución se paró sin dejar un error claro.",
    fix: "Pregúntale al ayudante: revisará la bitácora y te dirá qué cambiar.",
    guide: null,
    retry: true,
    editable: true,
  }
}
