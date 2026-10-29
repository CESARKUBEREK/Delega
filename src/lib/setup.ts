import "server-only"
import { createClient } from "@/lib/supabase/server"

// Pasos del asistente de configuración de un espacio nuevo. Cada persona
// conecta sus propias cuentas: las conexiones son de cada espacio.

export type SetupStepId = "ia" | "correo" | "drive" | "calendario" | "mensajeria" | "listo"

export type SetupStep = {
  id: SetupStepId
  title: string
  short: string
  why: string
  required: boolean
}

export const SETUP_STEPS: SetupStep[] = [
  {
    id: "ia",
    title: "Conecta tu IA",
    short: "IA",
    why: "Es el cerebro de MarchaSolo: entiende lo que pides, prepara los planes y redacta. Usa tu propia clave, así el consumo va a tu cuenta. Basta con una.",
    required: true,
  },
  {
    id: "correo",
    title: "Conecta tu correo",
    short: "Correo",
    why: "Para que MarchaSolo lea y clasifique tu bandeja y prepare respuestas. No envía nada sin que lo apruebes.",
    required: false,
  },
  {
    id: "drive",
    title: "Conecta Google Drive",
    short: "Drive",
    why: "Para trabajar con tus planillas, documentos y carpetas. Después eliges qué archivos puede usar: solo esos.",
    required: false,
  },
  {
    id: "calendario",
    title: "Conecta tu calendario",
    short: "Calendario",
    why: "Para consultar tu agenda («¿qué reuniones tengo mañana?») y proponer eventos, siempre con tu aprobación.",
    required: false,
  },
  {
    id: "mensajeria",
    title: "Habla con MarchaSolo desde el móvil",
    short: "Mensajería",
    why: "Con Telegram le pides cosas por texto o voz y apruebas con un toque. WhatsApp sirve para la bandeja y para responder a tus clientes.",
    required: false,
  },
  {
    id: "listo",
    title: "Pruébalo",
    short: "Listo",
    why: "Pide algo en el chat para ver cómo trabaja.",
    required: false,
  },
]

export type SetupStatus = Record<Exclude<SetupStepId, "listo">, boolean> & { done: number; total: number; complete: boolean }

// Qué pasos están hechos en este espacio (la RLS solo devuelve los datos de
// un espacio del que el usuario es miembro).
export async function setupStatus(workspaceId: string): Promise<SetupStatus> {
  const supabase = await createClient()
  const [{ data: ai }, { data: integrations }] = await Promise.all([
    supabase.from("ai_connections").select("status").eq("workspace_id", workspaceId),
    supabase
      .from("integrations")
      .select("provider, status")
      .eq("workspace_id", workspaceId)
      .in("provider", ["imap", "google", "calendar", "telegram", "whatsapp"]),
  ])
  const active = (provider: string) => (integrations ?? []).some((i) => i.provider === provider && i.status === "active")
  const status = {
    ia: (ai ?? []).some((c) => c.status === "active"),
    correo: active("imap"),
    drive: active("google"),
    calendario: active("calendar"),
    mensajeria: active("telegram") || active("whatsapp"),
  }
  const done = Object.values(status).filter(Boolean).length
  const total = Object.keys(status).length
  return { ...status, done, total, complete: done === total }
}

// Cookie que marca que el usuario está en el asistente: al volver de Google
// (Drive o Calendar), la app lo devuelve al paso en el que estaba.
export const SETUP_COOKIE = "ms_setup"
