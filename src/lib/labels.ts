import type { Enums } from "@/lib/supabase/database.types"

export const ROLE_LABEL: Record<Enums<"workspace_role">, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
}

export const KIND_LABEL: Record<Enums<"workspace_kind">, string> = {
  personal: "Espacio personal",
  organization: "Organización",
}

// De dónde salió una ejecución (flow_runs.trigger.type), para dar contexto
// junto a lo que espera aprobación.
export function runOrigin(trigger: unknown): string {
  const type = (trigger as { type?: string } | null)?.type
  if (type === "chat") return "Pedida en el chat"
  if (type === "telegram_message") return "Lanzada por un mensaje de Telegram"
  if (type === "whatsapp_message") return "Lanzada por un WhatsApp"
  if (type === "telegram_chat") return "Pedida desde tu Telegram"
  if (type === "email_message") return "Lanzada por un correo"
  if (type === "inbox_prepare") return (trigger as { mode?: string }).mode === "followup" ? "Recordatorio desde la bandeja" : "Respuesta desde la bandeja"
  if (type === "schedule") return "Ejecución programada"
  return "Automatización"
}
