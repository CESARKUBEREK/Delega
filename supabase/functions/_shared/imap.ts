// Correo de hosting por IMAP (lectura) y SMTP (envío).
//
// - Solo conexiones cifradas: IMAP en el puerto 993 y SMTP en el 465 (TLS
//   directo). Supabase bloquea las salidas a los puertos 25 y 587.
// - El servidor lo escribe el usuario: antes de conectar se resuelve su
//   nombre y se rechazan direcciones internas (localhost, redes privadas…).
//   La conexión va a la IP comprobada, con el nombre original para TLS.
// - Usuario y contraseña viven en Vault ({ user, password }); nunca se
//   registran en logs.
// - Solo se descarga la parte de texto de cada correo; de los adjuntos se
//   guarda el nombre.
import { ImapFlow } from "npm:imapflow@1.0.191"
import nodemailer from "npm:nodemailer@6.9.16"
import MailComposer from "npm:nodemailer@6.9.16/lib/mail-composer/index.js"
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { Buffer } from "node:buffer"
import { htmlToText, stripQuoted } from "./text.ts"
import { type InboxConfig, recordMessage } from "./inbox.ts"

export const IMAP_PORT = 993
export const SMTP_PORT = 465

export type ImapSecret = { user: string; password: string }
export type ImapConfig = InboxConfig & {
  email: string
  display_name?: string | null
  imap_host: string
  smtp_host: string
  sent_folder?: string | null
  uid_validity?: string | null
  last_uid?: number
  // Último UID que ya estaba en el buzón al conectarlo: hasta ahí es histórico
  // y no lanza automatizaciones, aunque se lea en varias vueltas.
  history_uid?: number
}

export class MailError extends Error {
  constructor(public code: "auth" | "connect" | "host" | "tls" | "smtp" | "mailbox" | "unavailable", message: string) {
    super(message)
  }
}

export function parseImapSecret(raw: string | null | undefined): ImapSecret | null {
  try {
    const s = JSON.parse(raw ?? "") as Partial<ImapSecret>
    if (typeof s.user === "string" && typeof s.password === "string" && s.user && s.password) return s as ImapSecret
  } catch {
    // formato no válido
  }
  return null
}

// Solo para pruebas locales con un servidor de correo de prueba (certificado
// propio, localhost y puertos distintos). Nunca se define en producción.
const TEST_MODE = Deno.env.get("MAIL_TEST_INSECURE") === "1"
const imapPort = () => (TEST_MODE ? Number(Deno.env.get("MAIL_TEST_IMAP_PORT") ?? IMAP_PORT) : IMAP_PORT)
const smtpPort = () => (TEST_MODE ? Number(Deno.env.get("MAIL_TEST_SMTP_PORT") ?? SMTP_PORT) : SMTP_PORT)

export const HOST_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i

function privateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase()
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:")
  }
  const [a, b] = ip.split(".").map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

// Resuelve el servidor y comprueba que es una dirección pública.
export async function resolveHost(host: string): Promise<string> {
  const name = host.trim().toLowerCase().replace(/\.$/, "")
  if (TEST_MODE && (name === "localhost" || name === "127.0.0.1")) return "127.0.0.1"
  if (!HOST_RE.test(name) || /(^|\.)(localhost|local|internal|lan|home|supabase\.co|supabase\.in)$/.test(name)) {
    throw new MailError("host", `«${host}» no es un servidor de correo válido.`)
  }
  let ips: string[] = []
  try {
    ips = await Deno.resolveDns(name, "A")
  } catch {
    try {
      ips = await Deno.resolveDns(name, "AAAA")
    } catch {
      ips = []
    }
  }
  if (!ips.length) throw new MailError("host", `No se encuentra el servidor «${host}». Revisa el nombre.`)
  if (ips.some(privateIp)) throw new MailError("host", `«${host}» apunta a una dirección interna: no se admite.`)
  return ips[0]
}

function describe(e: unknown, kind: "imap" | "smtp"): MailError {
  if (e instanceof MailError) return e
  const err = e as { authenticationFailed?: boolean; code?: string; responseCode?: number; message?: string; serverResponseCode?: string }
  const msg = String(err?.message ?? "")
  if (err?.authenticationFailed || err?.code === "EAUTH" || err?.responseCode === 535 || /auth|login|credential/i.test(msg)) {
    return new MailError("auth", kind === "imap"
      ? "El servidor IMAP rechazó el usuario o la contraseña. Si tu proveedor usa contraseñas de aplicación, crea una y úsala aquí."
      : "El servidor SMTP rechazó el usuario o la contraseña.")
  }
  if (/certificate|self.signed|CERT_|SSL|TLS/i.test(msg) || err?.code === "ESOCKET") {
    return new MailError("tls", `No se pudo establecer una conexión cifrada con el servidor ${kind === "imap" ? "IMAP (puerto 993)" : "SMTP (puerto 465)"}.`)
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENOTFOUND/i.test(msg + (err?.code ?? ""))) {
    return new MailError("connect", kind === "imap"
      ? "No se pudo conectar con el servidor IMAP en el puerto 993."
      : "No se pudo conectar con el servidor SMTP en el puerto 465. Si tu proveedor solo admite el 587, MarchaSolo no puede usarlo.")
  }
  return new MailError("unavailable", `El servidor de correo devolvió un error${kind === "smtp" ? " al enviar" : ""}.`)
}

// ---------------------------------------------------------------------------
// IMAP
// ---------------------------------------------------------------------------
export async function openImap(host: string, secret: ImapSecret): Promise<ImapFlow> {
  const ip = await resolveHost(host)
  const client = new ImapFlow({
    host: ip,
    port: imapPort(),
    secure: true,
    servername: host,
    auth: { user: secret.user, pass: secret.password },
    logger: false,
    emitLogs: false,
    disableAutoIdle: true,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 60_000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: !TEST_MODE },
  })
  // Sin este manejador, un error del socket tumbaría la función.
  client.on("error", () => undefined)
  try {
    await client.connect()
  } catch (e) {
    throw describe(e, "imap")
  }
  return client
}

export async function closeImap(client: ImapFlow) {
  await client.logout().catch(() => client.close())
}

type ListEntry = { path: string; specialUse?: string; flags?: Set<string> }

// Carpeta de enviados: la marcada como \Sent o, si no, un nombre habitual.
export async function findSentFolder(client: ImapFlow): Promise<string | null> {
  const list = (await client.list()) as ListEntry[]
  const special = list.find((b) => b.specialUse === "\\Sent")
  if (special) return special.path
  const names = ["sent", "sent items", "sent messages", "enviados", "elementos enviados", "inbox.sent", "inbox.enviados", "envoyés", "messages envoyés"]
  return list.find((b) => names.includes(b.path.toLowerCase()))?.path ?? null
}

type BodyNode = {
  part?: string
  type?: string
  parameters?: Record<string, string>
  disposition?: string
  dispositionParameters?: Record<string, string>
  childNodes?: BodyNode[]
}

function leaves(node: BodyNode | undefined, out: BodyNode[] = []): BodyNode[] {
  if (!node) return out
  if (node.childNodes?.length) node.childNodes.forEach((c) => leaves(c, out))
  else out.push({ ...node, part: node.part ?? "1" })
  return out
}

async function download(client: ImapFlow, uid: number, part: string): Promise<string> {
  const { content } = await client.download(String(uid), part, { uid: true, maxBytes: 150_000 })
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const c of content as AsyncIterable<Uint8Array>) {
    chunks.push(c)
    size += c.length
  }
  const all = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    all.set(c, offset)
    offset += c.length
  }
  // imapflow ya convierte el texto a UTF-8.
  return new TextDecoder().decode(all)
}

export type ImapMail = {
  uid: number
  messageId: string | null
  threadKey: string
  from: { name: string | null; address: string }
  to: string
  subject: string
  date: string
  body: string
  outgoing: boolean
  references: string | null
}

const addr = (a: { name?: string; address?: string } | undefined) => ({
  name: a?.name?.trim() || null,
  address: (a?.address ?? "").trim().toLowerCase(),
})

function headerValue(headers: string, name: string): string | null {
  const re = new RegExp(`^${name}:[ \\t]*((?:.*)(?:\\r?\\n[ \\t].*)*)`, "im")
  const m = headers.match(re)
  return m ? m[1].replace(/\r?\n[ \t]+/g, " ").trim() : null
}

const MSGID_RE = /<[^<>\s]{3,250}>/g

// Lee la tanda de correos indicada (UIDs ya conocidos), solo con su texto.
export async function readMails(client: ImapFlow, uids: number[], myAddress: string): Promise<ImapMail[]> {
  if (!uids.length) return []
  type Fetched = {
    uid: number
    envelope?: {
      date?: Date
      subject?: string
      messageId?: string
      inReplyTo?: string
      from?: { name?: string; address?: string }[]
      to?: { name?: string; address?: string }[]
    }
    bodyStructure?: BodyNode
    internalDate?: Date
    headers?: Uint8Array
  }
  // imapflow no admite otros comandos mientras dura un fetch: primero se recoge todo.
  const fetched: Fetched[] = []
  for await (const m of client.fetch(uids.join(","), { uid: true, envelope: true, bodyStructure: true, internalDate: true, headers: ["references"] }, { uid: true })) {
    fetched.push(m as Fetched)
  }

  const mails: ImapMail[] = []
  for (const m of fetched.sort((a, b) => a.uid - b.uid)) {
    const parts = leaves(m.bodyStructure)
    const isAttachment = (p: BodyNode) => p.disposition === "attachment" || Boolean(p.dispositionParameters?.filename)
    const plain = parts.find((p) => p.type === "text/plain" && !isAttachment(p))
    const html = parts.find((p) => p.type === "text/html" && !isAttachment(p))
    const attachments = parts
      .filter((p) => isAttachment(p) || (p.type && !p.type.startsWith("text/") && !p.type.startsWith("multipart/")))
      .map((p) => p.dispositionParameters?.filename ?? p.parameters?.name ?? "")
      .filter(Boolean)

    let text = ""
    try {
      if (plain) text = await download(client, m.uid, plain.part!)
      else if (html) text = htmlToText(await download(client, m.uid, html.part!))
    } catch {
      text = ""
    }
    const body = [stripQuoted(text.replace(/\r\n/g, "\n")).trim(), attachments.length ? `[adjuntos: ${attachments.join(", ")}]` : ""]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 20_000)

    const env = m.envelope ?? {}
    const from = addr(env.from?.[0])
    const references = headerValue(new TextDecoder().decode(m.headers ?? new Uint8Array()), "references")
    const refs = references?.match(MSGID_RE) ?? []
    const messageId = env.messageId?.match(MSGID_RE)?.[0] ?? null
    const parent = env.inReplyTo?.match(MSGID_RE)?.[0] ?? null
    // Hilo: el primer mensaje de la cadena de referencias.
    const root = refs[0] ?? parent ?? messageId ?? `uid-${m.uid}`

    mails.push({
      uid: m.uid,
      messageId,
      threadKey: await threadKey(root),
      from,
      to: (env.to ?? []).map((a) => addr(a).address).filter(Boolean).join(", ").slice(0, 2000),
      subject: (env.subject ?? "").slice(0, 300),
      date: (env.date ?? m.internalDate ?? new Date()).toISOString(),
      body,
      outgoing: from.address === myAddress.toLowerCase(),
      references,
    })
  }
  return mails
}

async function sha(value: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))
  return [...d].slice(0, 20).map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function threadKey(rootMessageId: string): Promise<string> {
  return `imap:${await sha(rootMessageId.toLowerCase())}`
}

// Identificador del mensaje en la bandeja: el propio Message-ID (sirve para
// responder en el mismo hilo) o, si es muy largo o no tiene, un resumen.
export async function messageKey(messageId: string | null, fallback: string): Promise<string> {
  if (messageId && messageId.length <= 190) return `imap:${messageId}`
  return `imap:#${messageId ? await sha(messageId.toLowerCase()) : fallback}`
}

// ---------------------------------------------------------------------------
// SMTP
// ---------------------------------------------------------------------------
export async function smtpTransport(host: string, secret: ImapSecret) {
  const ip = await resolveHost(host)
  return nodemailer.createTransport({
    host: ip,
    port: smtpPort(),
    secure: true,
    auth: { user: secret.user, pass: secret.password },
    name: "orkesta",
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { servername: host, minVersion: "TLSv1.2", rejectUnauthorized: !TEST_MODE },
    logger: false,
  })
}

export async function verifySmtp(host: string, secret: ImapSecret): Promise<void> {
  const transport = await smtpTransport(host, secret)
  try {
    await transport.verify()
  } catch (e) {
    throw describe(e, "smtp")
  } finally {
    transport.close()
  }
}

export type OutgoingMail = {
  fromName: string | null
  from: string
  to: string
  subject: string
  text: string
  inReplyTo?: string | null
  references?: string | null
}

// Construye el mensaje (RFC 5322) una sola vez: se envía por SMTP y la misma
// copia se guarda en la carpeta de enviados.
export async function buildMail(m: OutgoingMail): Promise<{ raw: Uint8Array; messageId: string }> {
  const domain = m.from.split("@")[1] || "orkesta.app"
  const messageId = `<${crypto.randomUUID()}@${domain}>`
  const composer = new MailComposer({
    from: m.fromName ? { name: m.fromName, address: m.from } : m.from,
    to: m.to,
    subject: m.subject,
    text: m.text,
    messageId,
    date: new Date(),
    ...(m.inReplyTo ? { inReplyTo: m.inReplyTo } : {}),
    ...(m.references || m.inReplyTo ? { references: [m.references, m.inReplyTo].filter(Boolean).join(" ") } : {}),
  })
  const raw = await new Promise<Uint8Array>((resolve, reject) =>
    composer.compile().build((e: Error | null, b: Uint8Array) => (e ? reject(e) : resolve(b)))
  )
  return { raw, messageId }
}

export async function sendViaSmtp(host: string, secret: ImapSecret, mail: OutgoingMail): Promise<{ messageId: string; raw: Uint8Array }> {
  const built = await buildMail(mail)
  const transport = await smtpTransport(host, secret)
  try {
    await transport.sendMail({ envelope: { from: mail.from, to: [mail.to] }, raw: built.raw })
  } catch (e) {
    throw describe(e, "smtp")
  } finally {
    transport.close()
  }
  return built
}

// ---------------------------------------------------------------------------
// Conexión guardada de un espacio
// ---------------------------------------------------------------------------
export async function imapAccount(admin: SupabaseClient, workspaceId: string): Promise<{ secret: ImapSecret; config: ImapConfig; integrationId: string }> {
  const [{ data: secretRows }, { data: integ }] = await Promise.all([
    admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "imap" }),
    admin.from("integrations").select("id, status, config").eq("workspace_id", workspaceId).eq("provider", "imap").maybeSingle(),
  ])
  const secret = parseImapSecret((secretRows?.[0] as { refresh_token?: string } | undefined)?.refresh_token)
  if (!secret || !integ) throw new MailError("mailbox", "El correo IMAP no está conectado.")
  if (integ.status !== "active") throw new MailError("auth", "El servidor de correo rechazó la contraseña. Vuelve a conectar el buzón.")
  return { secret, config: (integ.config ?? {}) as ImapConfig, integrationId: integ.id }
}

// Envía un correo nuevo o una respuesta por SMTP, guarda la copia en
// «Enviados» (si se puede) y lo registra en la bandeja.
export async function sendAndRecord(
  admin: SupabaseClient,
  workspaceId: string,
  input: { to: string; subject: string; text: string; threadExternalId?: string | null; inReplyTo?: string | null; references?: string | null; runId?: string | null; contactName?: string | null },
): Promise<{ messageId: string }> {
  const { secret, config, integrationId } = await imapAccount(admin, workspaceId)
  const mail: OutgoingMail = {
    fromName: config.display_name ?? null,
    from: config.email,
    to: input.to,
    subject: input.subject,
    text: input.text,
    inReplyTo: input.inReplyTo,
    references: input.references,
  }
  const sent = await sendViaSmtp(config.smtp_host, secret, mail)

  // Copia en «Enviados»: si falla, el correo ya salió; no se reintenta el envío.
  try {
    const client = await openImap(config.imap_host, secret)
    try {
      const folder = config.sent_folder || (await findSentFolder(client))
      if (folder) await client.append(folder, Buffer.from(sent.raw), ["\\Seen"])
    } finally {
      await closeImap(client)
    }
  } catch {
    console.error("imap: no se pudo guardar la copia en Enviados")
  }

  const root = input.references?.match(MSGID_RE)?.[0] ?? input.inReplyTo ?? sent.messageId
  await recordMessage(admin, {
    workspaceId,
    integrationId,
    channel: "email",
    threadExternalId: input.threadExternalId ?? (await threadKey(root)),
    externalId: await messageKey(sent.messageId, crypto.randomUUID()),
    direction: "out",
    senderName: config.display_name ?? null,
    senderAddress: config.email,
    recipients: input.to,
    subject: input.subject,
    body: input.text,
    sentAt: new Date().toISOString(),
    contactName: input.contactName ?? null,
    contactAddress: input.threadExternalId ? null : input.to,
    runId: input.runId ?? null,
  })
  return { messageId: sent.messageId }
}

// ---------------------------------------------------------------------------
// Lectura por tandas
// ---------------------------------------------------------------------------
const BATCH = 25
// Supabase limita el tiempo de CPU por petición (2 s): como mucho 100 correos
// por llamada (unos 0,5 s de CPU medidos); el resto, en la siguiente.
const MAX_PER_CALL = 100
// Primera lectura: como mucho los 400 correos más recientes de los últimos N
// días, para no llenar la bandeja (ni gastar la IA al clasificar) con el
// histórico. El correo que llega después se sigue leyendo entero.
export const MAX_INITIAL = 400

// fresh: correos recibidos nuevos (ni el histórico de la primera lectura ni
// los de más de 48 h), para el disparador «al llegar un correo».
export type FreshMail = { id: number; fromName: string | null; fromAddress: string; subject: string; body: string }

export async function syncImap(
  admin: SupabaseClient,
  workspaceId: string,
  deadline: number,
): Promise<{ added: number; more: boolean; fresh: FreshMail[] }> {
  const { secret, config, integrationId } = await imapAccount(admin, workspaceId)
  let client: ImapFlow
  try {
    client = await openImap(config.imap_host, secret)
  } catch (e) {
    if (e instanceof MailError && e.code === "auth") {
      await admin.rpc("integration_mark_invalid", { p_workspace_id: workspaceId, p_provider: "imap" })
    }
    throw e
  }

  let added = 0
  let more = false
  const fresh: FreshMail[] = []
  const next: ImapConfig = { ...config }
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true })
    try {
      const box = client.mailbox as { uidValidity: bigint | number; uidNext: number }
      const validity = String(box.uidValidity)
      let uids: number[]
      const initial = config.uid_validity !== validity
      if (initial) {
        // Primera vez (o el servidor renumeró la carpeta): los últimos N días.
        const since = new Date(Date.now() - (config.sync_days ?? 30) * 86_400_000)
        uids = ((await client.search({ since }, { uid: true })) || []) as number[]
        uids = uids.sort((a, b) => a - b).slice(-MAX_INITIAL)
        next.uid_validity = validity
        next.last_uid = 0
        next.history_uid = Math.max(0, box.uidNext - 1)
      } else {
        const last = config.last_uid ?? 0
        uids = last + 1 < box.uidNext ? (((await client.search({ uid: `${last + 1}:*` }, { uid: true })) || []) as number[]) : []
        uids = uids.filter((u) => u > last)
      }
      uids.sort((a, b) => a - b)

      for (let i = 0; i < uids.length && i < MAX_PER_CALL; i += BATCH) {
        if (Date.now() > deadline) break
        const batch = uids.slice(i, i + BATCH)
        const mails = await readMails(client, batch, config.email)
        for (const mail of mails) {
          const recorded = await recordMessage(admin, {
            workspaceId,
            integrationId,
            channel: "email",
            threadExternalId: mail.threadKey,
            externalId: await messageKey(mail.messageId, `${validity}:${mail.uid}`),
            direction: mail.outgoing ? "out" : "in",
            senderName: mail.from.name,
            senderAddress: mail.from.address,
            recipients: mail.to,
            subject: mail.subject,
            body: mail.body,
            sentAt: mail.date,
            contactName: mail.outgoing ? null : mail.from.name ?? mail.from.address,
            contactAddress: mail.outgoing ? null : mail.from.address,
          })
          if (recorded) {
            added++
            const time = Date.parse(mail.date)
            const historic = initial || mail.uid <= (next.history_uid ?? 0)
            if (!historic && !mail.outgoing && mail.from.address && Number.isFinite(time) && time > Date.now() - 48 * 3_600_000) {
              fresh.push({ id: recorded, fromName: mail.from.name, fromAddress: mail.from.address, subject: mail.subject ?? "", body: mail.body })
            }
          }
        }
        next.last_uid = batch[batch.length - 1]
      }
      more = uids.length > 0 && (next.last_uid ?? 0) < uids[uids.length - 1]
    } finally {
      lock.release()
    }
    if (!next.sent_folder) next.sent_folder = await findSentFolder(client).catch(() => null)
  } finally {
    await closeImap(client)
  }

  await admin.rpc("integration_set_config", {
    p_workspace_id: workspaceId,
    p_provider: "imap",
    p_config: { ...next, last_sync_at: new Date().toISOString() },
  })
  return { added, more, fresh }
}

// Cabeceras para responder en el mismo hilo: In-Reply-To es el último correo
// recibido y References, los Message-ID conocidos de la conversación.
export async function replyHeaders(admin: SupabaseClient, workspaceId: string, threadId: string): Promise<{ inReplyTo: string | null; references: string | null }> {
  const { data } = await admin
    .from("inbox_messages")
    .select("external_id, direction")
    .eq("thread_id", threadId)
    .eq("workspace_id", workspaceId)
    .order("sent_at")
    .limit(50)
  const rows = (data ?? []).filter((r) => r.external_id.startsWith("imap:<"))
  const ids = rows.map((r) => r.external_id.slice(5))
  const lastIn = [...rows].reverse().find((r) => r.direction === "in")
  return { inReplyTo: lastIn ? lastIn.external_id.slice(5) : ids.at(-1) ?? null, references: ids.slice(-10).join(" ") || null }
}
