"use client"

import { useActionState, useRef, useState, useTransition } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import {
  addContact,
  type ActionResult,
  type ContactState,
  disconnectWhatsApp,
  saveWhatsApp,
  whatsappWebhookInfo,
  type WhatsAppState,
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
        className="h-11 border border-rule bg-sheet px-3 text-sm text-ink placeholder:text-graphite/70 focus:border-stroke focus:outline-none"
        {...rest}
      />
      {hint ? <p className="text-xs text-graphite">{hint}</p> : null}
    </div>
  )
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 border border-rule bg-paper px-2 font-mono text-xs text-ink" />
        <button
          type="button"
          className="h-9 border border-ink px-3 text-xs text-ink"
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  )
}

function WebhookSteps({ url, token }: { url: string; token: string }) {
  return (
    <div className="flex flex-col gap-3 border-l-2 border-stroke pl-4">
      <p className="text-sm text-ink">
        En tu app de Meta → WhatsApp → Configuración → Webhook, pega estos dos datos, pulsa «Verificar y guardar» y
        suscríbete al campo <span className="font-mono">messages</span>.
      </p>
      <CopyField label="URL de devolución de llamada" value={url} />
      <CopyField label="Token de verificación" value={token} />
    </div>
  )
}

export function ConnectWhatsAppForm({ workspaceId }: { workspaceId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<WhatsAppState, FormData>(async (prev, fd) => {
    const result = await saveWhatsApp(prev, fd)
    // Los secretos no se quedan en el formulario.
    if (!result.error) formRef.current?.reset()
    return result
  }, {})

  if (state.webhookUrl && state.verifyToken) {
    return (
      <div className="flex flex-col gap-3">
        <FormMessage message={state.message} />
        <WebhookSteps url={state.webhookUrl} token={state.verifyToken} />
      </div>
    )
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Input id="wa-phone-id" name="phoneNumberId" label="Phone number ID" inputMode="numeric" autoComplete="off" required hint="En Meta → WhatsApp → Configuración de la API, bajo el número." />
      <Input id="wa-token" name="accessToken" type="password" label="Token de acceso" autoComplete="off" required hint="Mejor un token permanente de usuario del sistema; el temporal caduca en 24 h." />
      <Input id="wa-secret" name="appSecret" type="password" label="Secreto de la app" autoComplete="off" required hint="En Meta → Configuración de la app → Básica. Sirve para comprobar que los avisos vienen de Meta." />
      <FormMessage error={state.error} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Comprobando con Meta…">Conectar WhatsApp</SubmitButton>
      </div>
    </form>
  )
}

export function WebhookInfo({ workspaceId }: { workspaceId: string }) {
  const [info, setInfo] = useState<WhatsAppState | null>(null)
  const [pending, start] = useTransition()
  if (info?.webhookUrl && info.verifyToken) return <WebhookSteps url={info.webhookUrl} token={info.verifyToken} />
  return (
    <div className="flex flex-col gap-2">
      {info?.error ? <FormMessage error={info.error} /> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setInfo(await whatsappWebhookInfo(workspaceId)))}
        className="w-fit text-sm text-stroke underline underline-offset-4 disabled:opacity-60"
      >
        {pending ? "Cargando…" : "Ver los datos del webhook para Meta"}
      </button>
    </div>
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
        <Input id="contact-phone" name="phone" label="Teléfono" placeholder="+34600111222" inputMode="tel" required />
      </div>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel="Añadiendo…">Añadir contacto</SubmitButton>
      </div>
    </form>
  )
}

export function DisconnectWhatsAppForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(disconnectWhatsApp, null)
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        if (!window.confirm("¿Desconectar WhatsApp? Se borran las credenciales y los flujos dejarán de recibir mensajes.")) e.preventDefault()
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {state && !state.ok ? <FormMessage error={state.error} /> : null}
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : "Desconectar WhatsApp"}
      </button>
    </form>
  )
}
