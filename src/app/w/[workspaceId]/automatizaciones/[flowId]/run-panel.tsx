"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useState, useTransition } from "react"
import { FormMessage } from "@/components/form"
import { AI_PROVIDERS } from "@/lib/plan"
import { type AiKeyState, setFlowModel } from "../../ai-actions"
import { setFlowActive, startRun } from "../../run-actions"

export function RunPanel({
  workspaceId,
  flowId,
  files,
  aiReady,
  needsFiles,
  isAdmin,
}: {
  workspaceId: string
  flowId: string
  files: { id: string; name: string; kind: string }[]
  aiReady: boolean
  needsFiles: boolean
  isAdmin: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(files.length === 1 ? [files[0].id] : [])
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const base = `/w/${workspaceId}`

  if (!aiReady) {
    return (
      <p className="text-sm text-graphite">
        Para ejecutar hace falta una IA conectada (OpenAI, Anthropic o DeepSeek).{" "}
        <Link href={`${base}/integraciones`} className="text-link underline underline-offset-4">
          Ir a Integraciones
        </Link>
      </p>
    )
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s))
  }

  function run() {
    setError(null)
    startTransition(async () => {
      const result = await startRun({ workspaceId, flowId, fileIds: selected, note })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`${base}/ejecuciones/${result.runId}`)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Archivos para esta ejecución (máximo 5)</legend>
        {files.length > 0 ? (
          files.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} />
              {f.name} <span className="text-xs text-graphite">({f.kind})</span>
            </label>
          ))
        ) : (
          <p className="text-sm text-graphite">
            No hay archivos elegidos en este espacio.{" "}
            {isAdmin ? (
              <Link href={`${base}/integraciones`} className="text-link underline underline-offset-4">
                Conecta Google y elige archivos
              </Link>
            ) : (
              "Pide a un administrador que conecte Google y elija los archivos."
            )}
          </p>
        )}
        {needsFiles && files.length > 0 && selected.length === 0 ? (
          <p className="text-xs text-graphite">Este plan usa planillas o documentos: elige al menos uno.</p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="run-note" className="text-sm font-medium text-ink">
          Indicaciones para esta vez (opcional)
        </label>
        <textarea
          id="run-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Por ejemplo: usa la hoja «Octubre» y compárala con «Septiembre»."
          className="border border-rule bg-sheet px-3 py-2 text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none"
        />
      </div>

      {error ? (
        <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending || (needsFiles && files.length > 0 && selected.length === 0)}
          className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Iniciando…" : "Ejecutar ahora"}
        </button>
        <span className="text-xs text-graphite">Lee sin preguntar; cada escritura espera tu aprobación.</span>
      </div>
    </div>
  )
}

// Flujos con disparador automático (un mensaje al bot de Telegram o un correo
// recibido): se activan o pausan, se eligen los archivos que usará cada
// ejecución y, para el correo, qué correos la lanzan.
export type EmailFilterInput = { from: string[]; subject: string[]; words: string[]; skip_automatic: boolean }
export type ScheduleInput = { frequency: "daily" | "weekdays" | "weekly" | "monthly"; time: string; weekday: number; day_of_month: number }

const FREQUENCIES: { id: ScheduleInput["frequency"]; label: string }[] = [
  { id: "weekdays", label: "Días laborables (lunes a viernes)" },
  { id: "daily", label: "Todos los días" },
  { id: "weekly", label: "Una vez por semana" },
  { id: "monthly", label: "Una vez al mes" },
]
const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]

const joinList = (l: string[]) => l.join(", ")
const splitList = (v: string) =>
  v
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20)

export function ActivationPanel({
  workspaceId,
  flowId,
  status,
  trigger,
  files,
  savedFileIds,
  channelReady,
  emailFilter,
  schedule,
  nextRun,
  inboxBlocked,
  canEdit,
}: {
  workspaceId: string
  flowId: string
  status: string
  trigger: "telegram_message" | "email_message" | "schedule"
  files: { id: string; name: string; kind: string }[]
  savedFileIds: string[]
  channelReady: boolean
  emailFilter: EmailFilterInput
  schedule: ScheduleInput
  nextRun: string | null
  inboxBlocked: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>(savedFileIds.filter((id) => files.some((f) => f.id === id)))
  const [from, setFrom] = useState(joinList(emailFilter.from))
  const [subject, setSubject] = useState(joinList(emailFilter.subject))
  const [words, setWords] = useState(joinList(emailFilter.words))
  const [skipAutomatic, setSkipAutomatic] = useState(emailFilter.skip_automatic)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const active = status === "active"
  const email = trigger === "email_message"
  const scheduled = trigger === "schedule"
  const [frequency, setFrequency] = useState(schedule.frequency)
  const [time, setTime] = useState(schedule.time)
  const [weekday, setWeekday] = useState(schedule.weekday)
  const [dayOfMonth, setDayOfMonth] = useState(schedule.day_of_month)

  function save(nextActive: boolean) {
    setError(null)
    startTransition(async () => {
      const result = await setFlowActive({
        workspaceId,
        flowId,
        active: nextActive,
        fileIds: selected,
        emailFilter: email
          ? { from: splitList(from), subject: splitList(subject), words: splitList(words), skip_automatic: skipAutomatic }
          : undefined,
        schedule: scheduled ? { frequency, time, weekday, day_of_month: dayOfMonth } : undefined,
      })
      if (!result.ok) setError(result.error)
      router.refresh()
    })
  }

  if (inboxBlocked) {
    return (
      <p className="text-sm text-graphite">
        Esta automatización lee mensajes de la bandeja, que solo ven los administradores. Solo se lanza sola si la creó un administrador:
        pide a uno que la cree desde el asistente o desde una plantilla.
      </p>
    )
  }

  if (!channelReady && !scheduled) {
    return (
      <p className="text-sm text-graphite">
        {email
          ? "Este flujo arranca al llegar un correo. Primero conecta tu correo (IMAP) en "
          : "Este flujo arranca al recibir un mensaje en Telegram. Primero conecta tu bot en "}
        <Link href={`/w/${workspaceId}/integraciones`} className="text-link underline underline-offset-4">
          Integraciones
        </Link>
        .
      </p>
    )
  }

  const field = "border border-rule bg-sheet px-3 py-2 text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none"

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-graphite">
        {scheduled
          ? active
            ? nextRun
              ? `Activa. Próxima ejecución: ${nextRun}. Lo que quiera escribir o enviar a otros esperará tu aprobación; los avisos para ti te llegan directamente.`
              : "Activa, pero la programación no es válida: revísala y guarda."
            : "Pausada: no se ejecutará sola. Elige cuándo y actívala."
          : active
          ? email
            ? "Activo: cada correo nuevo que cumpla los filtros lanzará una ejecución (máximo 30 por hora). El correo se lee cada 5 minutos. Lo que quiera escribir o enviar esperará tu aprobación."
            : "Activo: cada mensaje que reciba el bot del espacio lanzará una ejecución (máximo 30 por hora). Lo que quiera escribir o enviar esperará tu aprobación."
          : email
            ? "Pausado: los correos que lleguen se guardan en la bandeja, pero no lanzan este flujo."
            : "Pausado: los mensajes que lleguen se registran, pero no lanzan este flujo."}
      </p>

      {scheduled ? (
        <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
          <legend className="mb-1 text-sm font-medium text-ink">Cuándo se ejecuta</legend>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Frecuencia
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as ScheduleInput["frequency"])} className={field}>
              {FREQUENCIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {frequency === "weekly" ? (
            <label className="flex flex-col gap-1 text-sm text-ink">
              Día
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={field}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {frequency === "monthly" ? (
            <label className="flex flex-col gap-1 text-sm text-ink">
              Día del mes
              <select value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} className={field}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value={0}>Último día del mes</option>
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm text-ink">
            Hora
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className={field} />
          </label>
          <p className="text-xs text-graphite">Hora del espacio (la de tu Google Calendar o, si no está conectado, la de Madrid).</p>
        </fieldset>
      ) : null}

      {email ? (
        <fieldset className="flex flex-col gap-3" disabled={!canEdit}>
          <legend className="mb-1 text-sm font-medium text-ink">Qué correos lo lanzan</legend>
          <p className="text-xs text-graphite">
            Separa las opciones con comas. Basta con que se cumpla una de cada casilla; las casillas vacías no filtran. Así no se
            gasta IA en correos que no interesan.
          </p>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Remitente contiene
            <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="@cliente.com, juan@" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Asunto contiene
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="presupuesto, pedido" className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Asunto o texto contiene
            <input value={words} onChange={(e) => setWords(e.target.value)} placeholder="visita, reunión, cita" className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={skipAutomatic} onChange={(e) => setSkipAutomatic(e.target.checked)} />
            Ignorar remitentes automáticos (no-reply, boletines, avisos)
          </label>
        </fieldset>
      ) : null}

      {files.length > 0 ? (
        <fieldset className="flex flex-col gap-2" disabled={!canEdit}>
          <legend className="mb-1 text-sm font-medium text-ink">Archivos que usará (máximo 5)</legend>
          {files.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={selected.includes(f.id)}
                onChange={() =>
                  setSelected((s) => (s.includes(f.id) ? s.filter((x) => x !== f.id) : s.length < 5 ? [...s, f.id] : s))
                }
              />
              {f.name} <span className="text-xs text-graphite">({f.kind})</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => save(true)}
            className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Guardando…" : active ? "Guardar cambios" : "Activar"}
          </button>
          {active ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(false)}
              className="h-11 border border-ink px-5 text-base font-medium text-ink hover:bg-paper disabled:opacity-60"
            >
              Pausar
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-graphite">Solo quien creó el flujo o un administrador puede activarlo.</p>
      )}
    </div>
  )
}

// Modelo de IA de esta automatización (o la IA principal del espacio).
export function FlowModelForm({
  workspaceId,
  flowId,
  model,
  providers,
  defaultLabel,
  canEdit,
}: {
  workspaceId: string
  flowId: string
  model: string
  providers: string[]
  defaultLabel: string
  canEdit: boolean
}) {
  const [state, action, pending] = useActionState<AiKeyState, FormData>(setFlowModel, {})
  const options = AI_PROVIDERS.filter((p) => providers.includes(p.id) || p.models.some((m) => m.id === model))
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="flowId" value={flowId} />
      <label htmlFor="flow-model" className="text-sm text-graphite">
        Qué IA ejecuta esta automatización. Si su proveedor deja de estar conectado, se usa la principal.
      </label>
      <select
        id="flow-model"
        name="model"
        defaultValue={model}
        disabled={!canEdit}
        className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none sm:max-w-md"
      >
        <option value="">IA principal del espacio{defaultLabel ? ` (${defaultLabel})` : ""}</option>
        {options.map((p) => (
          <optgroup key={p.id} label={p.label}>
            {p.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}: {m.hint}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <FormMessage error={state.error} message={state.message} />
      {canEdit ? (
        <button
          type="submit"
          disabled={pending}
          className="h-10 w-fit border border-ink bg-sheet px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      ) : (
        <p className="text-xs text-graphite">Solo quien creó la automatización o un administrador puede cambiarlo.</p>
      )}
    </form>
  )
}
