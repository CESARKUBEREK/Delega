"use client"

import { useActionState, useRef } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import {
  addContact,
  type ActionResult,
  type ContactState,
  disconnectGoogle,
  disconnectTelegram,
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
        className="h-11 border border-rule bg-sheet px-3 text-sm text-ink placeholder:text-graphite/70 focus:border-stroke focus:outline-none"
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
        hint="Te lo da @BotFather al crear el bot. Delega lo guarda cifrado y no vuelve a mostrarlo."
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

export function DisconnectInboxForm({ workspaceId, kind }: { workspaceId: string; kind: "gmail" | "telegram" }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    kind === "gmail" ? disconnectGoogle : disconnectTelegram,
    null,
  )
  const label = kind === "gmail" ? "Gmail" : "el bot de Telegram"
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        if (!window.confirm(`¿Desconectar ${label}? Delega pierde el acceso; las conversaciones ya guardadas siguen en la bandeja.`)) e.preventDefault()
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {kind === "gmail" ? <input type="hidden" name="product" value="gmail" /> : null}
      {state && !state.ok ? <FormMessage error={state.error} /> : null}
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : `Desconectar ${label}`}
      </button>
    </form>
  )
}
