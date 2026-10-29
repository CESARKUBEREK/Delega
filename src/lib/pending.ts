import type { Json } from "@/lib/supabase/database.types"

export type Cell = string | number | boolean | null
export type Pending =
  | { tool: "append_rows" | "update_range"; fileName: string; range: string; values: Cell[][]; before: Cell[][] | null }
  | { tool: "append_to_document"; fileName: string; text: string }
  | { tool: "create_document"; title: string; text: string }
  | { tool: "send_email"; to: string; address: string; subject: string; text: string }
  | { tool: "send_telegram"; to: string; text: string }
  | { tool: "send_whatsapp"; to: string; phone: string; text: string }
  // Archivos, eventos y CRM: la página ya prepara la descripción y los campos.
  | { tool: "generic"; description: string; verb: string; fields: Field[]; text: string | null; textCaption: string }

export type Field = { label: string; value: string; before?: string | null }

// Convierte la acción pendiente guardada en flow_runs.pending_action en lo que
// muestra la tarjeta de aprobación. No se fía de la forma del JSON.
export function asPending(value: Json | null): Pending | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const t = (x: unknown) => (typeof x === "string" ? x : "")
  switch (v.tool) {
    case "append_rows":
    case "update_range":
      if (!Array.isArray(v.values)) return null
      return {
        tool: v.tool,
        fileName: t(v.file_name),
        range: t(v.range),
        values: v.values as Cell[][],
        before: Array.isArray(v.before) ? (v.before as Cell[][]) : null,
      }
    case "append_to_document":
      return { tool: "append_to_document", fileName: t(v.file_name), text: t(v.text) }
    case "create_document":
      return { tool: "create_document", title: t(v.title), text: t(v.text) }
    case "send_email":
      return { tool: "send_email", to: t(v.to_label), address: t(v.address), subject: t(v.subject), text: t(v.body) }
    case "send_telegram":
      return { tool: "send_telegram", to: t(v.to_label), text: t(v.text) }
    case "send_whatsapp":
      return { tool: "send_whatsapp", to: t(v.to_label), phone: t(v.phone), text: t(v.text) }
    case "api_request":
      return {
        tool: "generic",
        description: `Enviar una petición ${t(v.method)} a ${t(v.connection_name)}.`,
        verb: "Aprobar petición",
        fields: [
          { label: "Método", value: t(v.method) },
          { label: "Ruta", value: t(v.path) },
          ...(t(v.query) ? [{ label: "Parámetros", value: t(v.query) }] : []),
        ],
        text: t(v.body) || null,
        textCaption: "Cuerpo JSON",
      }
    case "tokko_lead": {
      const ids = Array.isArray(v.property_ids) ? v.property_ids.filter((x) => typeof x === "number").map((x) => `#${x}`).join(", ") : ""
      return {
        tool: "generic",
        description: "Registrar esta consulta en el CRM de Tokko Broker.",
        verb: "Aprobar y registrar",
        fields: [
          { label: "Nombre", value: t(v.name) },
          ...(t(v.email) ? [{ label: "Correo", value: t(v.email) }] : []),
          ...(t(v.phone) ? [{ label: "Teléfono", value: t(v.phone) }] : []),
          ...(ids ? [{ label: "Propiedades", value: ids }] : []),
        ],
        text: t(v.text),
        textCaption: "Consulta",
      }
    }
    case "save_file": {
      const ext = v.format === "documento" ? "documento de Google" : v.format === "csv" ? "CSV" : "texto"
      return {
        tool: "generic",
        description: `Guardar «${t(v.name)}» (${ext}) en la carpeta «${t(v.folder_name)}».`,
        verb: "Aprobar y guardar",
        fields: [],
        text: t(v.text),
        textCaption: "Contenido",
      }
    }
    case "create_event": {
      const ev = obj(v.event)
      const attendees = Array.isArray(v.attendees) ? v.attendees.map((a) => `${t(obj(a).label)} <${t(obj(a).email)}>`).join(", ") : ""
      return {
        tool: "generic",
        description: attendees
          ? "Crear este evento en tu calendario y enviar la invitación a los invitados."
          : "Crear este evento en tu calendario.",
        verb: "Aprobar y crear",
        fields: [
          { label: "Título", value: t(ev.title) },
          { label: ev.all_day ? "Día" : "Inicio", value: when(t(ev.start)) },
          ...(ev.all_day ? [] : [{ label: "Fin", value: when(t(ev.end)) }]),
          ...(t(ev.location) ? [{ label: "Lugar", value: t(ev.location) }] : []),
          ...(attendees ? [{ label: "Invitados", value: attendees }] : []),
        ],
        text: t(ev.description) || null,
        textCaption: "Descripción",
      }
    }
    case "update_event": {
      const c = obj(v.changes)
      const fields = [
        ["title", "Título"],
        ["start", "Inicio"],
        ["end", "Fin"],
        ["location", "Lugar"],
        ["description", "Descripción"],
      ]
        .filter(([k]) => typeof c[k] === "string" && c[k])
        .map(([k, label]) => ({ label, value: k === "start" || k === "end" ? when(t(c[k])) : t(c[k]) }))
      return {
        tool: "generic",
        description: `Cambiar el evento «${t(v.title_before)}» (${t(v.when_before)}). Se avisará a sus invitados.`,
        verb: "Aprobar y cambiar",
        fields,
        text: null,
        textCaption: "",
      }
    }
    case "crm_create":
    case "crm_update": {
      const props = obj(v.properties)
      const before = obj(v.before)
      const label = CRM_LABEL[t(v.object)] ?? "registro"
      return {
        tool: "generic",
        description: v.tool === "crm_create" ? `Crear un ${label} en HubSpot.` : `Actualizar el ${label} «${t(v.label)}» en HubSpot.`,
        verb: v.tool === "crm_create" ? "Aprobar y crear" : "Aprobar y actualizar",
        fields: Object.entries(props).map(([k, val]) =>
          v.tool === "crm_update" ? { label: k, value: t(val), before: typeof before[k] === "string" ? (before[k] as string) : null } : { label: k, value: t(val) }
        ),
        text: null,
        textCaption: "",
      }
    }
    case "crm_note":
      return {
        tool: "generic",
        description: `Añadir esta nota al ${CRM_LABEL[t(v.object)] ?? "registro"} «${t(v.label)}» en HubSpot.`,
        verb: "Aprobar y añadir",
        fields: [],
        text: t(v.text),
        textCaption: "Nota",
      }
    case "crm_task":
      return {
        tool: "generic",
        description: `Crear una tarea para el ${CRM_LABEL[t(v.object)] ?? "registro"} «${t(v.label)}» en HubSpot.`,
        verb: "Aprobar y crear",
        fields: [
          { label: "Asunto", value: t(v.subject) },
          { label: "Vence", value: t(v.due_date) ? when(t(v.due_date)) : "mañana" },
        ],
        text: t(v.text) || null,
        textCaption: "Detalle",
      }
    default:
      return null
  }
}

const CRM_LABEL: Record<string, string> = { contacts: "contacto", companies: "empresa", deals: "negocio" }

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {}
}

// "2026-11-03T10:00" → "3 nov 2026, 10:00"; "2026-11-03" → "3 nov 2026".
function when(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return value
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  const date = `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`
  return m[4] ? `${date}, ${m[4]}:${m[5]}` : date
}

// Frase corta de lo que espera aprobación, para listas (pantalla Hoy).
export function pendingTitle(p: Pending): string {
  switch (p.tool) {
    case "append_rows":
      return `Añadir ${p.values.length === 1 ? "1 fila" : `${p.values.length} filas`} a «${p.fileName}»`
    case "update_range":
      return `Cambiar celdas de «${p.fileName}»`
    case "append_to_document":
      return `Añadir texto a «${p.fileName}»`
    case "create_document":
      return `Crear el documento «${p.title}»`
    case "send_email":
      return `Enviar un correo a ${p.to || p.address}`
    case "send_telegram":
      return `Enviar un Telegram a ${p.to}`
    case "send_whatsapp":
      return `Enviar un WhatsApp a ${p.to || p.phone}`
    case "generic":
      return p.description.replace(/\.$/, "")
  }
}

// Qué tipo de acción es, para el icono de la tarjeta.
export function pendingKind(p: Pending): "email" | "sheet" | "doc" | "message" | "other" {
  if (p.tool === "send_email") return "email"
  if (p.tool === "append_rows" || p.tool === "update_range") return "sheet"
  if (p.tool === "append_to_document" || p.tool === "create_document") return "doc"
  if (p.tool === "send_telegram" || p.tool === "send_whatsapp") return "message"
  return "other"
}
