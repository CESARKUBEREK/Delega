// Clasificación de la bandeja sin IA: reglas de la persona, remitentes
// automáticos (boletines, avisos) y facturas. Lo que se resuelve aquí no gasta
// la clave de IA del cliente. Funciones puras (se prueban en inbox-rules.test.ts).
import { isAutomaticSender } from "./triggers.ts"

export type InboxRule = { match_type: "sender" | "domain"; value: string; category: string }

export type RuleInput = {
  address: string | null
  subject: string | null
  automatic: boolean // cabeceras List-Unsubscribe, List-Id, Precedence: bulk… (lo marca la lectura IMAP)
}

export type RuleResult = {
  category: string
  source: "rule"
  automatic: boolean
  // Las conversaciones automáticas no pasan por la IA.
  skipAi: boolean
}

const AUTOMATIC_SUBJECT_RE =
  /\b(newsletter|bolet[ií]n|unsubscribe|darse de baja|webinar|promo(ci[oó]n)?|oferta exclusiva|black friday|tu pedido ha sido enviado|order (shipped|confirmation)|verification code|c[oó]digo de verificaci[oó]n)\b/i
const INVOICE_SUBJECT_RE = /\b(factura|invoice|recibo|receipt|comprobante|payment|pago recibido|remittance)\b/i
const BILLING_SENDER_RE = /^(billing|facturacion|facturación|invoices?|facturas?|receipts?|payments?|pagos?|accounts?-?payable)([+@._-]|$)/i

export function domainOf(address: string | null | undefined): string | null {
  const a = (address ?? "").trim().toLowerCase()
  const at = a.lastIndexOf("@")
  return at > 0 && at < a.length - 3 ? a.slice(at + 1) : null
}

// Dominios de correo personal: una regla «todo @gmail.com» no tiene sentido.
export const PUBLIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "live.com", "yahoo.com", "yahoo.es",
  "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "aol.com", "msn.com",
])

// Categoría para boletines y avisos: «Publicidad» si existe; si no, la última.
export function automaticCategory(categories: string[]): string {
  return categories.find((c) => c.toLowerCase() === "publicidad") ?? categories[categories.length - 1]
}

function invoiceCategory(categories: string[]): string | null {
  return categories.find((c) => /administraci|factura|pagos?|contabilidad/i.test(c)) ?? null
}

export function applyRules(input: RuleInput, rules: InboxRule[], categories: string[]): RuleResult | null {
  const address = (input.address ?? "").trim().toLowerCase()
  const domain = domainOf(address)
  // 1. Reglas de la persona: primero el remitente exacto, luego el dominio.
  const exact = rules.find((r) => r.match_type === "sender" && r.value === address)
  const byDomain = domain ? rules.find((r) => r.match_type === "domain" && (domain === r.value || domain.endsWith(`.${r.value}`))) : undefined
  const rule = exact ?? byDomain
  if (rule && categories.includes(rule.category)) {
    const auto = rule.category === automaticCategory(categories) && (input.automatic || isAutomaticSender(address))
    return { category: rule.category, source: "rule", automatic: auto, skipAi: auto }
  }
  // 2. Facturas de remitentes de facturación (billing@, facturas@…).
  const subject = input.subject ?? ""
  const invoice = invoiceCategory(categories)
  if (invoice && address && BILLING_SENDER_RE.test(address) && INVOICE_SUBJECT_RE.test(subject)) {
    return { category: invoice, source: "rule", automatic: true, skipAi: true }
  }
  // 3. Boletines y avisos automáticos.
  if (input.automatic || (address && isAutomaticSender(address)) || AUTOMATIC_SUBJECT_RE.test(subject)) {
    return { category: automaticCategory(categories), source: "rule", automatic: true, skipAi: true }
  }
  return null
}

// Fecha límite para los seguimientos: hace N días laborables (lunes a viernes).
export function businessDaysAgo(days: number, from = new Date()): Date {
  const d = new Date(from)
  let left = days
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() - 1)
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) left--
  }
  return d
}
