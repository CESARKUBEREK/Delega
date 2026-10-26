"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ReactNode, useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import { FormMessage } from "@/components/form"
import { TRIGGER_LABEL } from "@/lib/plan"
import {
  CONNECTION_NAME,
  CONNECTION_PROVIDER,
  type ConnectionKind,
  type EditorPlan,
  type EditorStep,
  KIND_CONNECTIONS,
  KIND_INFO,
  MAX_DESCRIPTION,
  MAX_FILES,
  MAX_STEPS,
  MAX_TITLE,
  needsApproval,
  NOTIFY_TARGET,
  planChecks,
  STEP_KINDS,
  type StepKind,
  TRIGGERS,
} from "@/lib/plan-edit"
import { saveFlowPlan, suggestStep } from "../flow-editor-actions"

// Editor visual de una automatización: una tarjeta de inicio y una lista de
// pasos que se ejecutan en orden. El agente sigue los pasos y entiende las
// condiciones escritas, así que no hay ramas ni flechas: solo el orden.

type Step = EditorStep & { key: string }
type FileOption = { id: string; name: string; kind: string }

const TRIGGER_HINT: Record<string, string> = {
  manual: "La lanzas tú cuando quieras, desde la app o desde Telegram.",
  schedule: "Se ejecuta sola. La hora y los días se eligen al activarla.",
  email_message: "Arranca al llegar un correo. Qué correos la lanzan se elige al activarla.",
  telegram_message: "Arranca cuando alguien (que no seas tú) escribe al bot del espacio.",
  whatsapp_message: "Arranca cuando un cliente te escribe por WhatsApp. Contestar siempre espera tu aprobación.",
}

// Claves estables para React (no se guardan: al guardar, los pasos se numeran s1, s2…).
let counter = 0
const newKey = () => `k${(counter++).toString(36)}`

export function FlowEditor({
  workspaceId,
  flowId,
  initial,
  initialFileIds,
  files,
  connected,
  contacts,
  aiReady,
}: {
  workspaceId: string
  flowId: string | null
  initial: EditorPlan
  initialFileIds: string[]
  files: FileOption[]
  connected: string[]
  contacts: number
  aiReady: boolean
}) {
  const router = useRouter()
  const base = `/w/${workspaceId}`
  const [name, setName] = useState(initial.name)
  const [summary, setSummary] = useState(initial.summary)
  const [trigger, setTrigger] = useState(initial.trigger)
  const [steps, setSteps] = useState<Step[]>(() => initial.steps.map((s, i) => ({ ...s, key: `i${i}` })))
  const [fileIds, setFileIds] = useState<string[]>(initialFileIds)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<number | null>(initial.steps.length === 0 ? 0 : null)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  const connectedSet = useMemo(() => new Set(connected), [connected])
  const plan: EditorPlan = { name, summary, trigger, steps }
  const checks = planChecks(plan, {
    connected: connectedSet,
    fileKinds: files.filter((f) => fileIds.includes(f.id)).map((f) => f.kind),
    contacts,
  })

  function update(key: string, patch: Partial<EditorStep>) {
    setSteps((list) =>
      list.map((s) => {
        if (s.key !== key) return s
        const next = { ...s, ...patch }
        // Si la aplicación no vale para el nuevo tipo de paso, se pone la primera válida.
        const allowed = KIND_CONNECTIONS[next.kind as StepKind] as string[]
        if (!allowed.includes(next.connection)) next.connection = allowed.find((c) => c === "none" || connectedSet.has(CONNECTION_PROVIDER[c as ConnectionKind])) ?? allowed[0]
        return next
      }),
    )
  }

  function move(index: number, delta: number) {
    setSteps((list) => {
      const to = index + delta
      if (to < 0 || to >= list.length) return list
      const copy = [...list]
      ;[copy[index], copy[to]] = [copy[to], copy[index]]
      return copy
    })
  }

  function duplicate(index: number) {
    if (steps.length >= MAX_STEPS) return
    setSteps((list) => [...list.slice(0, index + 1), { ...list[index], key: newKey() }, ...list.slice(index + 1)])
  }

  function remove(key: string) {
    setSteps((list) => list.filter((s) => s.key !== key))
    if (editing === key) setEditing(null)
  }

  function insert(index: number, step: EditorStep) {
    const key = newKey()
    setSteps((list) => [...list.slice(0, index), { ...step, key }, ...list.slice(index)])
    setAdding(null)
    setEditing(key)
  }

  function toggleFile(id: string) {
    setFileIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_FILES ? [...list, id] : list))
  }

  function save() {
    setError(null)
    startSaving(async () => {
      const result = await saveFlowPlan({
        workspaceId,
        flowId,
        plan: { name, summary, trigger, steps: steps.map(({ kind, title, description, connection }) => ({ kind, title, description, connection })) },
        fileIds,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`${base}/automatizaciones/${result.flowId}${result.paused ? "?pausada=1" : ""}`)
    })
  }

  const context = `${name}${summary ? `: ${summary}` : ""}\nInicio: ${TRIGGER_LABEL[trigger.type]}\nPasos: ${steps.map((s, i) => `${i + 1}. ${s.title}`).join("; ")}`

  return (
    <div className="flex flex-col gap-6">
      {/* Nombre */}
      <section className="flex flex-col gap-3 border border-ink bg-sheet p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Nombre</span>
          <input
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="Por ejemplo: Avisos de cobros pendientes"
            className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Qué hace, en una frase</span>
          <input
            value={summary}
            maxLength={600}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Opcional"
            className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none"
          />
        </label>
      </section>

      {/* Inicio */}
      <section aria-labelledby="inicio" className="border border-ink bg-sheet">
        <h2 id="inicio" className="flex items-center gap-2 border-b border-ink px-5 py-3 font-semibold">
          <span aria-hidden="true" className="rotulo text-sm text-turquesa">
            ▶
          </span>
          Cuándo empieza
        </h2>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div role="radiogroup" aria-label="Cuándo empieza" className="grid gap-2 sm:grid-cols-2">
            {TRIGGERS.map((t) => {
              const needs = t === "email_message" ? "imap" : t === "telegram_message" ? "telegram" : t === "whatsapp_message" ? "whatsapp" : null
              const off = needs !== null && !connectedSet.has(needs)
              return (
                <label
                  key={t}
                  className={`flex cursor-pointer items-start gap-2 border px-3 py-2 text-sm ${
                    trigger.type === t ? "border-ink bg-paper" : "border-rule"
                  } ${off ? "opacity-60" : ""}`}
                >
                  <input type="radio" name="trigger" className="mt-1" checked={trigger.type === t} onChange={() => setTrigger({ ...trigger, type: t })} />
                  <span>
                    <span className="block font-medium text-ink">{TRIGGER_LABEL[t]}</span>
                    {off ? <span className="block text-xs text-graphite">{needs === "imap" ? "Correo" : needs === "whatsapp" ? "WhatsApp" : "Telegram"} no está conectado</span> : null}
                  </span>
                </label>
              )
            })}
          </div>
          <p className="text-sm text-graphite">{TRIGGER_HINT[trigger.type]}</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Cuándo, en palabras</span>
            <input
              value={trigger.description}
              maxLength={200}
              onChange={(e) => setTrigger({ ...trigger, description: e.target.value })}
              placeholder={trigger.type === "schedule" ? "Cada lunes a las 9:00" : trigger.type === "email_message" ? "Cuando un cliente pide presupuesto" : "Opcional"}
              className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none"
            />
          </label>
        </div>
      </section>

      {/* Pasos */}
      <section aria-labelledby="pasos" className="flex flex-col">
        <h2 id="pasos" className="mb-3 font-semibold text-ink">
          Pasos <span className="font-normal text-graphite">(se hacen en este orden)</span>
        </h2>
        <ol className="flex flex-col">
          {steps.map((step, i) => (
            <li key={step.key} className="flex flex-col">
              <InsertPoint index={i} adding={adding} setAdding={setAdding} full={steps.length >= MAX_STEPS} onInsert={insert} workspaceId={workspaceId} aiReady={aiReady} context={context} />
              <StepCard
                step={step}
                index={i}
                total={steps.length}
                open={editing === step.key}
                connectedSet={connectedSet}
                onToggle={() => setEditing(editing === step.key ? null : step.key)}
                onChange={(patch) => update(step.key, patch)}
                onMove={(d) => move(i, d)}
                onDuplicate={() => duplicate(i)}
                onRemove={() => remove(step.key)}
                canDuplicate={steps.length < MAX_STEPS}
              />
            </li>
          ))}
        </ol>
        <InsertPoint
          index={steps.length}
          adding={adding}
          setAdding={setAdding}
          full={steps.length >= MAX_STEPS}
          onInsert={insert}
          workspaceId={workspaceId}
          aiReady={aiReady}
          context={context}
          last
        />
      </section>

      {/* Archivos */}
      <section aria-labelledby="archivos" className="border border-ink bg-sheet">
        <h2 id="archivos" className="border-b border-ink px-5 py-3 font-semibold">
          Archivos que usa <span className="font-normal text-graphite">(hasta {MAX_FILES})</span>
        </h2>
        <div className="px-5 py-4">
          {files.length === 0 ? (
            <p className="text-sm text-graphite">
              Aún no has elegido archivos de Drive.{" "}
              <Link href={`${base}/integraciones`} className="text-link underline underline-offset-4">
                Elígelos en Integraciones
              </Link>{" "}
              y vuelve aquí.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {files.map((f) => (
                <li key={f.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={fileIds.includes(f.id)} onChange={() => toggleFile(f.id)} disabled={!fileIds.includes(f.id) && fileIds.length >= MAX_FILES} />
                    <span className="min-w-0 truncate text-ink">{f.name}</span>
                    <span className="shrink-0 text-xs text-graphite">{f.kind}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-graphite">Los pasos pueden referirse a ellos por su nombre («la planilla Vencimientos»).</p>
        </div>
      </section>

      {/* Comprobaciones */}
      {checks.length > 0 ? (
        <section aria-labelledby="revisar" className="border-l-2 border-alert bg-alert-bg px-4 py-3">
          <h2 id="revisar" className="text-sm font-semibold text-alert">
            Antes de activarla, revisa
          </h2>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink">
            {checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : steps.length > 0 ? (
        <p className="border-l-2 border-ok bg-ok-bg px-4 py-2 text-sm text-ok">Todo en orden.</p>
      ) : null}

      <FormMessage error={error ?? undefined} />

      {/* En el móvil queda fija justo encima de la barra de navegación inferior. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 grid grid-cols-[1fr_auto] gap-2 border-t border-ink bg-paper px-4 py-3 lg:static lg:mx-0 lg:flex lg:border-0 lg:bg-transparent lg:px-0">
        <button
          type="button"
          onClick={save}
          disabled={saving || steps.length === 0 || !name.trim()}
          className="h-11 bg-stroke px-6 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Guardando…" : flowId ? "Guardar cambios" : "Crear automatización"}
        </button>
        <Link
          href={flowId ? `${base}/automatizaciones/${flowId}` : `${base}/automatizaciones`}
          className="flex h-11 items-center justify-center border border-ink px-6 text-base font-medium text-ink hover:bg-paper"
        >
          Cancelar
        </Link>
      </div>
      <p className="text-xs text-graphite">
        Lo que escriba o envíe a otras personas siempre espera tu aprobación, en la app o en Telegram. {flowId ? "" : "Se guarda como borrador: la activas después."}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta de un paso
// ---------------------------------------------------------------------------
function StepCard({
  step,
  index,
  total,
  open,
  connectedSet,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  canDuplicate,
}: {
  step: Step
  index: number
  total: number
  open: boolean
  connectedSet: Set<string>
  onToggle: () => void
  onChange: (patch: Partial<EditorStep>) => void
  onMove: (delta: number) => void
  onDuplicate: () => void
  onRemove: () => void
  canDuplicate: boolean
}) {
  const id = useId()
  const kind = step.kind as StepKind
  const approval = needsApproval(step.kind, step.connection)
  const appLabel =
    step.kind === "notify" ? NOTIFY_TARGET[step.connection as keyof typeof NOTIFY_TARGET]?.split(" (")[0] : step.connection !== "none" ? CONNECTION_NAME[step.connection as ConnectionKind] : null
  const offline = step.connection !== "none" && step.connection in CONNECTION_PROVIDER && !connectedSet.has(CONNECTION_PROVIDER[step.connection as ConnectionKind])

  return (
    <div className={`border bg-sheet ${open ? "border-ink" : "border-rule"}`}>
      <div className="grid grid-cols-[2.25rem_1fr] gap-2 px-4 py-3">
        <span aria-hidden="true" className="rotulo pt-0.5 text-sm text-graphite">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="block w-full text-left">
            <span className="sr-only">Paso {index + 1}: </span>
            <span className="block font-medium text-ink">{step.title || <span className="text-graphite">Paso sin título</span>}</span>
            {step.description ? <span className="mt-0.5 line-clamp-2 block text-sm text-graphite">{step.description}</span> : null}
          </button>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="border border-rule px-1.5 py-0.5 text-ink">{KIND_INFO[kind]?.label ?? step.kind}</span>
            {appLabel ? <span className={`px-0.5 py-0.5 ${offline ? "text-alert" : "text-graphite"}`}>{appLabel}{offline ? " (no conectado)" : ""}</span> : null}
            {approval ? <span className="py-0.5 font-medium text-ink">✋ Necesita tu aprobación</span> : null}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button type="button" onClick={onToggle} className="text-link underline underline-offset-4">
              {open ? "Cerrar" : "Editar"}
            </button>
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="text-ink disabled:opacity-30" aria-label={`Subir el paso ${index + 1}`}>
              ↑ Subir
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="text-ink disabled:opacity-30" aria-label={`Bajar el paso ${index + 1}`}>
              ↓ Bajar
            </button>
            <button type="button" onClick={onDuplicate} disabled={!canDuplicate} className="text-ink disabled:opacity-30">
              Duplicar
            </button>
            <button type="button" onClick={onRemove} className="text-alert">
              Borrar
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <StepSheet id={id} onClose={onToggle} title={`Paso ${index + 1}`}>
          <StepFields step={step} onChange={onChange} connectedSet={connectedSet} />
        </StepSheet>
      ) : null}
    </div>
  )
}

// En el móvil, el paso se edita en un panel que sube desde abajo; en
// pantallas grandes, dentro de la propia tarjeta.
function StepSheet({ id, title, onClose, children }: { id: string; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  // Solo al abrir: foco en el primer campo y Escape para cerrar.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
  return (
    <>
      <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-[45] bg-ink/30 lg:hidden" />
      <div
        id={id}
        ref={ref}
        role="group"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto border-t-2 border-ink bg-sheet px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 lg:static lg:z-auto lg:max-h-none lg:border-t lg:border-rule lg:px-4 lg:pb-4"
      >
        <div className="sticky -top-3 z-10 -mx-4 mb-3 flex items-center justify-between border-b border-rule bg-sheet px-4 lg:hidden">
          <p className="font-semibold text-ink">{title}</p>
          <button type="button" onClick={onClose} className="h-11 px-3 text-link underline underline-offset-4">
            Listo
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

function StepFields({ step, onChange, connectedSet }: { step: EditorStep; onChange: (patch: Partial<EditorStep>) => void; connectedSet: Set<string> }) {
  const kind = step.kind as StepKind
  const options = (KIND_CONNECTIONS[kind] ?? ["none"]).filter(
    (c) => c === "none" || c === step.connection || connectedSet.has(CONNECTION_PROVIDER[c as ConnectionKind]),
  )
  const titleId = useId()
  const descId = useId()
  const connId = useId()
  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="text-sm font-medium text-ink">Qué hace</legend>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {STEP_KINDS.map((k) => (
            <label key={k} className={`flex cursor-pointer items-start gap-2 border px-3 py-2 text-sm ${kind === k ? "border-ink bg-paper" : "border-rule"}`}>
              <input type="radio" className="mt-1" checked={kind === k} onChange={() => onChange({ kind: k })} />
              <span>
                <span className="block font-medium text-ink">{KIND_INFO[k].label}</span>
                <span className="block text-xs text-graphite">{KIND_INFO[k].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {options.length > 1 || options[0] !== "none" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={connId} className="text-sm font-medium text-ink">
            {kind === "notify" ? "A quién" : "Con qué aplicación"}
          </label>
          <select
            id={connId}
            value={step.connection}
            onChange={(e) => onChange({ connection: e.target.value })}
            className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none"
          >
            {options.map((c) => (
              <option key={c} value={c}>
                {kind === "notify" ? NOTIFY_TARGET[c as keyof typeof NOTIFY_TARGET] : CONNECTION_NAME[c]}
                {c !== "none" && !connectedSet.has(CONNECTION_PROVIDER[c as ConnectionKind]) ? " (no conectado)" : ""}
              </option>
            ))}
          </select>
          {(KIND_CONNECTIONS[kind] ?? []).length > options.length ? (
            <p className="text-xs text-graphite">Solo aparecen las aplicaciones conectadas en Integraciones.</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleId} className="text-sm font-medium text-ink">
          Título
        </label>
        <input
          id={titleId}
          value={step.title}
          maxLength={MAX_TITLE}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Leer la planilla de cobros"
          className="h-11 border border-rule bg-sheet px-3 text-base text-ink focus:border-link focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={descId} className="text-sm font-medium text-ink">
          Instrucciones, en tus palabras
        </label>
        <textarea
          id={descId}
          value={step.description}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Solo las filas con estado «pendiente» y fecha de esta semana."
          className="border border-rule bg-sheet px-3 py-2 text-base text-ink focus:border-link focus:outline-none"
        />
      </div>
      <p className="text-xs text-graphite">
        {needsApproval(step.kind, step.connection)
          ? "✋ Este paso esperará tu aprobación antes de escribir o enviar nada. No se puede quitar."
          : step.kind === "notify"
            ? "Los avisos para ti salen sin aprobación, por los canales que elegiste en Mis avisos."
            : "Este paso solo consulta o prepara: no necesita aprobación."}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Añadir un paso: con tus palabras (la IA lo completa) o a mano
// ---------------------------------------------------------------------------
function InsertPoint({
  index,
  adding,
  setAdding,
  full,
  onInsert,
  workspaceId,
  aiReady,
  context,
  last = false,
}: {
  index: number
  adding: number | null
  setAdding: (i: number | null) => void
  full: boolean
  onInsert: (index: number, step: EditorStep) => void
  workspaceId: string
  aiReady: boolean
  context: string
  last?: boolean
}) {
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const textId = useId()

  if (adding !== index) {
    if (full) return last ? <p className="mt-3 text-sm text-graphite">Has llegado al máximo de {MAX_STEPS} pasos.</p> : <div className="h-3" />
    return last ? (
      <button
        type="button"
        onClick={() => setAdding(index)}
        className="mt-3 flex h-11 items-center justify-center border border-dashed border-ink text-base font-medium text-ink hover:bg-paper"
      >
        + Añadir paso
      </button>
    ) : (
      <div className="flex justify-center py-1">
        <button
          type="button"
          onClick={() => setAdding(index)}
          aria-label={`Añadir un paso antes del paso ${index + 1}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-rule bg-sheet text-graphite hover:border-ink hover:text-ink"
        >
          +
        </button>
      </div>
    )
  }

  function withAi() {
    setError(null)
    startTransition(async () => {
      const result = await suggestStep({ workspaceId, text, context })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setText("")
      onInsert(index, result.step)
    })
  }

  function byHand() {
    const t = text.trim()
    onInsert(index, { kind: "read", title: t.slice(0, 60), description: t, connection: "none" })
    setText("")
  }

  return (
    <div className={`${last ? "mt-3" : "my-2"} flex flex-col gap-3 border border-dashed border-ink bg-sheet p-4`}>
      <label htmlFor={textId} className="text-sm font-medium text-ink">
        {index === 0 && last ? "Primer paso: ¿qué tiene que hacer?" : "Nuevo paso: ¿qué tiene que hacer?"}
      </label>
      <textarea
        id={textId}
        value={text}
        rows={2}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        placeholder="Por ejemplo: busca en la planilla los cobros que vencen esta semana"
        className="border border-rule bg-sheet px-3 py-2 text-base text-ink focus:border-link focus:outline-none"
      />
      <FormMessage error={error ?? undefined} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {aiReady ? (
          <button
            type="button"
            onClick={withAi}
            disabled={pending || !text.trim()}
            className="h-11 bg-stroke px-4 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Preparando…" : "Complétalo tú (IA)"}
          </button>
        ) : null}
        <button type="button" onClick={byHand} disabled={pending} className="h-11 border border-ink px-4 text-base font-medium text-ink hover:bg-paper disabled:opacity-60">
          Rellenar a mano
        </button>
        <button type="button" onClick={() => setAdding(null)} disabled={pending} className="h-11 px-4 text-base text-link underline underline-offset-4">
          Cancelar
        </button>
      </div>
    </div>
  )
}
