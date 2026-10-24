"use client"

import { useActionState } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { type NoticeState, saveNoticePrefs, setWorkspaceTimezone, startTelegramLink, unlinkTelegram } from "./notice-actions"

const field = "border border-rule bg-sheet px-3 py-2 text-sm text-ink focus:border-link focus:outline-none"

export function TimezoneForm({ workspaceId, current, zones }: { workspaceId: string; current: string | null; zones: string[] }) {
  const [state, action] = useActionState<NoticeState, FormData>(setWorkspaceTimezone, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label className="flex flex-col gap-1 text-sm text-ink">
        Zona horaria
        <select name="timezone" defaultValue={current ?? ""} className={field}>
          <option value="">Automática (Google Calendar o, si no, Madrid)</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Guardando…">Guardar zona horaria</SubmitButton>
      </div>
    </form>
  )
}

export function NoticePrefsForm({
  workspaceId,
  prefs,
  mailReady,
  telegramLinked,
}: {
  workspaceId: string
  prefs: { push: boolean; email: boolean; telegram: boolean }
  mailReady: boolean
  telegramLinked: boolean
}) {
  const [state, action] = useActionState<NoticeState, FormData>(saveNoticePrefs, {})
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Por dónde te llegan los avisos de tus automatizaciones</legend>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="push" defaultChecked={prefs.push} /> Notificación en el móvil (solo el nombre de la automatización)
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="email" defaultChecked={prefs.email} /> Correo a tu dirección, con el texto completo
          {mailReady ? null : <span className="text-xs text-graphite">(hace falta un correo conectado en el espacio)</span>}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="telegram" defaultChecked={prefs.telegram} /> Telegram, con el texto completo
          {telegramLinked ? null : <span className="text-xs text-graphite">(vincula tu chat abajo)</span>}
        </label>
      </fieldset>
      <p className="text-xs text-graphite">El aviso queda siempre guardado en la ejecución, aunque desactives todos los canales.</p>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel="Guardando…">Guardar preferencias</SubmitButton>
      </div>
    </form>
  )
}

export function TelegramLink({
  workspaceId,
  botUsername,
  linkedName,
}: {
  workspaceId: string
  botUsername: string | null
  linkedName: string | null
}) {
  const [startState, start] = useActionState<NoticeState, FormData>(startTelegramLink, {})
  const [unlinkState, unlink] = useActionState<NoticeState, FormData>(unlinkTelegram, {})

  if (!botUsername) {
    return <p className="text-sm text-graphite">Para recibir avisos por Telegram, un administrador tiene que conectar el bot del espacio en Integraciones.</p>
  }

  if (linkedName !== null) {
    return (
      <form action={unlink} className="flex flex-col gap-2">
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <p className="text-sm text-ink">
          Tu Telegram{linkedName ? ` (${linkedName})` : ""} está vinculado con @{botUsername}.
        </p>
        <FormMessage error={unlinkState.error} message={unlinkState.message} />
        <button type="submit" className="w-fit text-sm text-alert underline underline-offset-4">
          Desvincular mi Telegram
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {startState.code ? (
        <div className="flex flex-col gap-2 border-l-2 border-link pl-3 text-sm text-ink">
          <a
            href={`https://t.me/${botUsername}?start=${startState.code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit font-medium text-link underline underline-offset-4"
          >
            Abrir @{botUsername} en Telegram y vincular
          </a>
          <p className="text-graphite">
            O escribe al bot: <span className="font-mono text-ink">/vincular {startState.code}</span>. El código caduca en 15 minutos.
          </p>
        </div>
      ) : null}
      <form action={start}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <FormMessage error={startState.error} />
        <div className="sm:max-w-56">
          <SubmitButton pendingLabel="Generando…">{startState.code ? "Generar otro código" : "Vincular mi Telegram"}</SubmitButton>
        </div>
      </form>
    </div>
  )
}
