"use client"

import { useActionState, useRef, useState } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import {
  addContact,
  type ActionResult,
  type ContactState,
  disconnectGoogle,
  disconnectHubSpot,
  disconnectImap,
  disconnectTelegram,
  type ImapState,
  saveImap,
  type HubSpotState,
  saveHubSpot,
  saveTelegram,
  type TelegramState,
} from "../run-actions"

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string }) {
  const { label, hint, id, ...rest } = props
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        className="h-11 border border-rule bg-sheet px-3 text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none"
        {...rest}
      />
      {hint ? <p className="text-xs text-graphite">{hint}</p> : null}
    </div>
  )
}

export function TelegramForm({ workspaceId, replacing }: { workspaceId: string; replacing: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<TelegramState, FormData>(async (prev, fd) => {
    const result = await saveTelegram(prev, fd)
    // El token no se queda en el formulario.
    formRef.current?.reset()
    return result
  }, {})
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Input
        id="tg-token"
        name="botToken"
        type="password"
        label={replacing ? "Nuevo token del bot" : "Token del bot"}
        autoComplete="off"
        spellCheck={false}
        required
        hint="Te lo da @BotFather al crear el bot. Orkesta lo guarda cifrado y no vuelve a mostrarlo."
      />
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Comprobando con Telegram…">{replacing ? "Cambiar bot" : "Conectar bot"}</SubmitButton>
      </div>
    </form>
  )
}

export function AddContactForm({ workspaceId }: { workspaceId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<ContactState, FormData>(async (prev, fd) => {
    const result = await addContact(prev, fd)
    if (!result.error) formRef.current?.reset()
    return result
  }, {})
  return (
    <form ref={formRef} action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input id="contact-name" name="name" label="Nombre" maxLength={120} required />
        <Input id="contact-email" name="email" type="email" label="Correo" placeholder="nombre@empresa.com" maxLength={320} required />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Añadiendo…">Añadir contacto</SubmitButton>
      </div>
    </form>
  )
}

export function HubSpotForm({ workspaceId, replacing }: { workspaceId: string; replacing: boolean }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<HubSpotState, FormData>(async (prev, fd) => {
    const result = await saveHubSpot(prev, fd)
    // La clave no se queda en el formulario.
    formRef.current?.reset()
    return result
  }, {})
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Input
        id="hs-token"
        name="token"
        type="password"
        label={replacing ? "Nueva clave de HubSpot" : "Clave de HubSpot"}
        autoComplete="off"
        spellCheck={false}
        required
        hint="Clave de servicio o token de app privada. Orkesta la guarda cifrada y no vuelve a mostrarla."
      />
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Comprobando con HubSpot…">{replacing ? "Cambiar clave" : "Conectar HubSpot"}</SubmitButton>
      </div>
    </form>
  )
}

const DISCONNECT: Record<string, { label: string; confirm: string }> = {
  gmail: { label: "Gmail", confirm: "¿Desconectar Gmail? Orkesta pierde el acceso; las conversaciones ya guardadas siguen en la bandeja." },
  telegram: { label: "el bot de Telegram", confirm: "¿Desconectar el bot de Telegram? Dejarán de llegar mensajes a la bandeja." },
  calendar: { label: "Google Calendar", confirm: "¿Desconectar Google Calendar? Las automatizaciones dejarán de ver y crear eventos." },
  hubspot: { label: "HubSpot", confirm: "¿Desconectar HubSpot? Orkesta borra la clave; revócala también en HubSpot si ya no la usas." },
  imap: { label: "el correo", confirm: "¿Desconectar este correo? Orkesta borra la contraseña; las conversaciones ya guardadas siguen en la bandeja." },
}

export function DisconnectInboxForm({ workspaceId, kind }: { workspaceId: string; kind: "gmail" | "telegram" | "calendar" | "hubspot" | "imap" }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    kind === "gmail" || kind === "calendar"
      ? disconnectGoogle
      : kind === "hubspot"
        ? disconnectHubSpot
        : kind === "imap"
          ? disconnectImap
          : disconnectTelegram,
    null,
  )
  const { label, confirm } = DISCONNECT[kind]
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault()
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {kind === "gmail" || kind === "calendar" ? <input type="hidden" name="product" value={kind} /> : null}
      {state && !state.ok ? <FormMessage error={state.error} /> : null}
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : `Desconectar ${label}`}
      </button>
    </form>
  )
}

// Servidores de los proveedores habituales (IMAP 993 y SMTP 465, cifrados).
// «{dominio}» se sustituye por el dominio de la dirección de correo.
const MAIL_PROVIDERS = [
  { id: "otro", label: "Otro proveedor", imap: "", smtp: "" },
  { id: "hosting", label: "Mi hosting (cPanel, SiteGround, Plesk…)", imap: "mail.{dominio}", smtp: "mail.{dominio}" },
  { id: "ovh", label: "OVH (MX Plan)", imap: "ssl0.ovh.net", smtp: "ssl0.ovh.net" },
  { id: "ionos", label: "IONOS (España)", imap: "imap.ionos.es", smtp: "smtp.ionos.es" },
  { id: "hostinger", label: "Hostinger", imap: "imap.hostinger.com", smtp: "smtp.hostinger.com" },
  { id: "strato", label: "Strato", imap: "imap.strato.de", smtp: "smtp.strato.de" },
  { id: "godaddy", label: "GoDaddy", imap: "imap.secureserver.net", smtp: "smtpout.secureserver.net" },
  { id: "gandi", label: "Gandi", imap: "mail.gandi.net", smtp: "mail.gandi.net" },
  { id: "zoho", label: "Zoho Mail (Europa)", imap: "imap.zoho.eu", smtp: "smtp.zoho.eu" },
  { id: "fastmail", label: "Fastmail", imap: "imap.fastmail.com", smtp: "smtp.fastmail.com" },
  { id: "yahoo", label: "Yahoo", imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com" },
]

export function ImapForm({ workspaceId, current }: { workspaceId: string; current: { email: string; imapHost: string; smtpHost: string; displayName: string } | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [provider, setProvider] = useState(current ? "otro" : "hosting")
  const [email, setEmail] = useState(current?.email ?? "")
  const [imapHost, setImapHost] = useState(current?.imapHost ?? "")
  const [smtpHost, setSmtpHost] = useState(current?.smtpHost ?? "")
  const [state, action] = useActionState<ImapState, FormData>(async (prev, fd) => {
    const result = await saveImap(prev, fd)
    // La contraseña no se queda en el formulario.
    const pw = formRef.current?.elements.namedItem("password") as HTMLInputElement | null
    if (pw) pw.value = ""
    return result
  }, {})

  const domain = email.split("@")[1]?.trim().toLowerCase() ?? ""
  function fill(id: string, mail = email) {
    const p = MAIL_PROVIDERS.find((x) => x.id === id)
    const d = mail.split("@")[1]?.trim().toLowerCase() ?? ""
    if (!p || p.id === "otro") return
    setImapHost(p.imap.replace("{dominio}", d))
    setSmtpHost(p.smtp.replace("{dominio}", d))
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="imap-provider" className="text-sm font-medium text-ink">
          Proveedor
        </label>
        <select
          id="imap-provider"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value)
            fill(e.target.value)
          }}
          className="h-11 border border-rule bg-sheet px-3 text-sm text-ink focus:border-link focus:outline-none"
        >
          {MAIL_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="imap-email"
          name="email"
          type="email"
          label="Dirección de correo"
          placeholder="nombre@tudominio.com"
          autoComplete="off"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (provider === "hosting") fill(provider, e.target.value)
          }}
          required
        />
        <Input id="imap-name" name="displayName" label="Nombre del remitente (opcional)" placeholder="Estudio Ruiz" defaultValue={current?.displayName ?? ""} maxLength={120} />
      </div>
      <Input
        id="imap-password"
        name="password"
        type="password"
        label={current ? "Contraseña (vuelve a escribirla para guardar cambios)" : "Contraseña"}
        autoComplete="off"
        required
        hint="Si tu proveedor ofrece «contraseñas de aplicación», crea una para Orkesta y úsala aquí. Se guarda cifrada y no se vuelve a mostrar."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="imap-host"
          name="imapHost"
          label="Servidor IMAP (puerto 993)"
          placeholder={domain ? `imap.${domain}` : "imap.tudominio.com"}
          value={imapHost}
          onChange={(e) => setImapHost(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <Input
          id="smtp-host"
          name="smtpHost"
          label="Servidor SMTP (puerto 465)"
          placeholder={domain ? `smtp.${domain}` : "smtp.tudominio.com"}
          value={smtpHost}
          onChange={(e) => setSmtpHost(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <details className="text-sm text-graphite">
        <summary className="cursor-pointer text-ink">Usuario distinto de la dirección</summary>
        <div className="mt-3">
          <Input id="imap-user" name="user" label="Usuario" placeholder="Solo si tu proveedor usa otro distinto de la dirección" autoComplete="off" spellCheck={false} />
        </div>
      </details>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-64">
        <SubmitButton pendingLabel="Comprobando el correo…">{current ? "Guardar cambios" : "Conectar correo"}</SubmitButton>
      </div>
    </form>
  )
}
