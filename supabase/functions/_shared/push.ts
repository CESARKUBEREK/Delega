// Avisos Web Push (RFC 8030) con VAPID (RFC 8292) y cifrado aes128gcm
// (RFC 8188 + RFC 8291), solo con WebCrypto: sin dependencias.
//
// Secretos de la función:
//   VAPID_PUBLIC_KEY   clave pública P-256 sin comprimir, base64url (65 bytes)
//   VAPID_PRIVATE_KEY  clave privada P-256, base64url (32 bytes)
//   VAPID_SUBJECT      opcional: mailto:… o https://… de contacto
//
// El contenido del aviso va cifrado de extremo a extremo hasta el navegador.
// Aun así, el texto se ve en la pantalla de bloqueo: nunca incluye datos de
// clientes (destinatarios, asuntos, importes), solo el nombre del flujo.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"

const enc = new TextEncoder()

// Servicios de push de los navegadores. Solo se envía a estos dominios.
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
]

export function isPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((re) => re.test(url.hostname))
  } catch {
    return false
  }
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export function b64urlEncode(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

// ---------------------------------------------------------------------------
// VAPID
// ---------------------------------------------------------------------------
type Vapid = { publicKey: string; privateKey: CryptoKey; subject: string }
let vapid: Promise<Vapid | null> | null = null

function loadVapid(): Promise<Vapid | null> {
  vapid ??= (async () => {
    const pub = Deno.env.get("VAPID_PUBLIC_KEY")?.trim()
    const priv = Deno.env.get("VAPID_PRIVATE_KEY")?.trim()
    if (!pub || !priv) return null
    const p = b64urlDecode(pub)
    const d = b64urlDecode(priv)
    if (p.length !== 65 || p[0] !== 4 || d.length !== 32) {
      console.error("push: claves VAPID con formato no válido")
      return null
    }
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: b64urlEncode(p.slice(1, 33)), y: b64urlEncode(p.slice(33, 65)), d: b64urlEncode(d), ext: false },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    )
    const site = (Deno.env.get("DELEGA_SITE_URL") ?? "https://delega-five.vercel.app").replace(/\/+$/, "")
    const subject = Deno.env.get("VAPID_SUBJECT")?.trim() || site
    return { publicKey: b64urlEncode(p), privateKey, subject }
  })()
  return vapid
}

export async function pushConfigured(): Promise<boolean> {
  return (await loadVapid()) !== null
}

async function vapidAuthorization(v: Vapid, endpoint: string): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })),
  )
  const unsigned = `${header}.${claims}`
  // WebCrypto devuelve la firma ECDSA en formato r||s (64 bytes), el que pide JWS.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.privateKey, enc.encode(unsigned)))
  return `vapid t=${unsigned}.${b64urlEncode(signature)}, k=${v.publicKey}`
}

// ---------------------------------------------------------------------------
// Cifrado aes128gcm (un solo registro)
// ---------------------------------------------------------------------------
async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8))
}

export async function encryptPayload(p256dh: string, authSecret: string, plaintext: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64urlDecode(p256dh)
  const auth = b64urlDecode(authSecret)
  if (uaPublic.length !== 65 || auth.length !== 16) throw new Error("claves del dispositivo no válidas")

  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey))
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256))

  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16)
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12)

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"])
  // 0x02: delimitador del último (y único) registro, sin relleno.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(plaintext, new Uint8Array([2]))))

  const header = new Uint8Array(21 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, cipher)
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------
export type PushPayload = { title: string; body: string; url: string; tag?: string }

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

export async function sendPush(admin: SupabaseClient, userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  const v = await loadVapid()
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!v || !ids.length) return { sent: 0, failed: 0 }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", ids)
    .limit(50)
  if (!subs?.length) return { sent: 0, failed: 0 }

  const body = enc.encode(
    JSON.stringify({
      title: clip(payload.title, 80),
      body: clip(payload.body, 240),
      url: payload.url.startsWith("/") ? payload.url.slice(0, 300) : "/w",
      tag: payload.tag ? payload.tag.slice(0, 80) : undefined,
    }),
  )

  let sent = 0
  let failed = 0
  const gone: string[] = []
  const used: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      if (!isPushEndpoint(s.endpoint)) {
        gone.push(s.id)
        return
      }
      try {
        const res = await fetch(s.endpoint, {
          method: "POST",
          headers: {
            Authorization: await vapidAuthorization(v, s.endpoint),
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: "86400",
            Urgency: "high",
          },
          body: await encryptPayload(s.p256dh, s.auth, body),
          signal: AbortSignal.timeout(8000),
        })
        await res.body?.cancel()
        if (res.ok) {
          sent++
          used.push(s.id)
        } else {
          failed++
          // 404/410: el navegador anuló la suscripción.
          if (res.status === 404 || res.status === 410) gone.push(s.id)
          else console.error("push: el servicio respondió", res.status)
        }
      } catch {
        failed++
      }
    }),
  )
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone)
  if (used.length) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", used)
  return { sent, failed }
}

// Frase neutra para la pantalla de bloqueo, sin datos del cliente.
const ACTION_PHRASE: Record<string, string> = {
  append_rows: "quiere escribir en una planilla",
  update_range: "quiere modificar una planilla",
  append_to_document: "quiere añadir texto a un documento",
  create_document: "quiere crear un documento",
  save_file: "quiere guardar un archivo en Drive",
  send_email: "quiere enviar un correo",
  send_telegram: "quiere responder por Telegram",
  send_whatsapp: "quiere responder por WhatsApp",
  create_event: "quiere crear un evento",
  update_event: "quiere cambiar un evento",
  crm_create: "quiere crear un registro en HubSpot",
  crm_update: "quiere actualizar HubSpot",
  crm_note: "quiere añadir una nota en HubSpot",
  crm_task: "quiere crear una tarea en HubSpot",
}

// Avisa de que una ejecución espera aprobación: a quien la lanzó o, si no
// hay nadie (lanzada por un mensaje sin autor), a los administradores.
export async function notifyApproval(
  admin: SupabaseClient,
  run: { id: string; workspace_id: string; flow_name: string; started_by: string | null },
  tool: string,
): Promise<void> {
  if (!(await pushConfigured())) return
  const { data: members } = await admin
    .from("memberships")
    .select("user_id, role")
    .eq("workspace_id", run.workspace_id)
    .eq("status", "active")
  const active = members ?? []
  const recipients = run.started_by && active.some((m) => m.user_id === run.started_by)
    ? [run.started_by]
    : active.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.user_id)
  await sendPush(admin, recipients, {
    title: "Necesita tu aprobación",
    body: `«${clip(run.flow_name, 80)}» ${ACTION_PHRASE[tool] ?? "quiere hacer un cambio"}.`,
    url: `/w/${run.workspace_id}/aprobaciones`,
    tag: `run-${run.id}`,
  })
}
