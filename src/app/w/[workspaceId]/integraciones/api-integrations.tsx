"use client"

import { useActionState, useRef, useState } from "react"
import { FormMessage, SubmitButton } from "@/components/form"
import { disconnectApiConnection, saveApiConnection, type ApiConnectionState } from "./api-actions"

type Provider = "supabase" | "custom_1" | "custom_2"
type Connection = { status: string; config: unknown } | null

function configOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function Field({ id, label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <input id={id} className="h-11 border border-rule bg-sheet px-3 text-sm text-ink placeholder:text-graphite/70 focus:border-link focus:outline-none" {...props} />
      {hint ? <p className="text-xs text-graphite">{hint}</p> : null}
    </div>
  )
}

export function ApiIntegrationCard({
  workspaceId,
  provider,
  connection,
  isAdmin,
}: {
  workspaceId: string
  provider: Provider
  connection: Connection
  isAdmin: boolean
}) {
  const active = connection?.status === "active"
  const [open, setOpen] = useState(!active)
  const config = configOf(connection?.config)
  const supabase = provider === "supabase"
  const slot = provider === "custom_1" ? "1" : "2"
  const title = supabase ? "Supabase" : (typeof config.name === "string" && config.name ? config.name : `API a medida ${slot}`)
  const subtitle = supabase
    ? "Consulta tus tablas usando tu clave pública y las políticas RLS de tu proyecto."
    : "Conecta una API REST propia. Las consultas se ejecutan desde tus automatizaciones; las escrituras esperan tu aprobación."
  const badge = active ? "Conectado" : connection?.status === "invalid" ? "Revisar conexión" : "Sin conectar"

  return (
    <details name="integrations" className="integration-accordion border border-rule bg-sheet" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="integration-summary flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <h3 className="rotulo text-lg">{title}</h3>
          <p className="text-sm text-graphite">{subtitle}</p>
        </div>
        <span className={`shrink-0 border px-2 py-0.5 text-xs ${active ? "border-ok bg-ok-bg text-ok" : "border-rule text-graphite"}`}>{badge}</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-rule px-4 py-4">
        {active ? (
          <p className="break-all text-xs text-graphite">
            {supabase ? "Proyecto: " : "URL base: "}
            {String(config.project_url ?? config.base_url ?? "")}
          </p>
        ) : null}
        {isAdmin ? (
          supabase
            ? <SupabaseForm workspaceId={workspaceId} />
            : <CustomApiForm workspaceId={workspaceId} provider={provider} slot={slot} currentName={typeof config.name === "string" ? config.name : ""} />
        ) : (
          <p className="text-sm text-graphite">Solo un administrador puede gestionar esta conexión.</p>
        )}
        {active && isAdmin ? <DisconnectForm workspaceId={workspaceId} provider={provider} title={title} /> : null}
      </div>
    </details>
  )
}

function SupabaseForm({ workspaceId }: { workspaceId: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action] = useActionState<ApiConnectionState, FormData>(async (previous, data) => {
    const result = await saveApiConnection(previous, data)
    if (result.ok) formRef.current?.reset()
    return result
  }, {})
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="provider" value="supabase" />
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <Field
        id="supabase-project-url"
        name="project_url"
        type="url"
        label="URL del proyecto"
        placeholder="https://tu-proyecto.supabase.co"
        autoComplete="url"
        required
        maxLength={500}
        hint="En Supabase: Project Settings → Data API → Project URL (https://….supabase.co)."
      />
      <Field
        id="supabase-anon-key"
        name="anon_key"
        type="password"
        label="Clave anon / publishable"
        placeholder="sb_publishable_… o anon key"
        autoComplete="off"
        spellCheck={false}
        required
        maxLength={1000}
        hint="Project Settings → API Keys → la publishable (o la anon). Nunca la secret ni la service_role: MarchaSolo trabaja como anon y tus reglas RLS deciden qué puede ver y cambiar."
      />
      <details className="rounded-lg border border-rule px-3 py-2 text-xs text-graphite">
        <summary className="cursor-pointer text-sm font-medium text-ink">Después de conectar: qué tablas puede usar</summary>
        <p className="mt-2">
          MarchaSolo solo ve las tablas que tus reglas RLS permiten al rol <code>anon</code>. Por ejemplo, para que pueda leer la tabla{" "}
          <code>clientes</code>, ejecuta esto en el SQL Editor de tu proyecto:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-paper p-2 text-[11px] text-ink">{`alter table public.clientes enable row level security;
grant select on public.clientes to anon;
create policy "MarchaSolo lee clientes" on public.clientes
  for select to anon using (true);`}</pre>
        <p className="mt-2">
          Para que pueda añadir o cambiar filas, haz lo mismo con <code>insert</code> o <code>update</code>. Cada escritura espera tu aprobación en MarchaSolo.
          La tabla tiene que estar en el esquema <code>public</code> (o en uno expuesto en Data API).
        </p>
      </details>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-60"><SubmitButton pendingLabel="Comprobando proyecto…">Conectar Supabase</SubmitButton></div>
    </form>
  )
}

function CustomApiForm({
  workspaceId,
  provider,
  slot,
  currentName,
}: {
  workspaceId: string
  provider: "custom_1" | "custom_2"
  slot: string
  currentName: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [authType, setAuthType] = useState("bearer")
  const [state, action] = useActionState<ApiConnectionState, FormData>(async (previous, data) => {
    const result = await saveApiConnection(previous, data)
    if (result.ok) formRef.current?.reset()
    return result
  }, {})
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`custom-api-${slot}-name`} name="name" label="Nombre de la conexión" placeholder="Por ejemplo: Mi sistema" defaultValue={currentName} required maxLength={60} />
        <Field id={`custom-api-${slot}-url`} name="base_url" type="url" label="URL base HTTPS" placeholder="https://api.ejemplo.com/v1" required maxLength={500} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`custom-api-${slot}-auth`} className="text-sm font-medium text-ink">Autenticación</label>
        <select id={`custom-api-${slot}-auth`} name="auth_type" value={authType} onChange={(event) => setAuthType(event.target.value)} className="h-11 border border-rule bg-sheet px-3 text-sm text-ink focus:border-link focus:outline-none">
          <option value="bearer">Bearer token</option>
          <option value="header">Clave en una cabecera</option>
          <option value="none">Sin autenticación</option>
        </select>
        <p className="text-xs text-graphite">La credencial se cifra y nunca vuelve a mostrarse.</p>
      </div>
      {authType === "header" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`custom-api-${slot}-header`} name="header_name" label="Nombre de la cabecera" placeholder="X-API-Key" required maxLength={80} />
          <Field id={`custom-api-${slot}-token`} name="token" type="password" label="Clave API" autoComplete="off" required maxLength={1500} />
        </div>
      ) : authType === "bearer" ? (
        <Field id={`custom-api-${slot}-token`} name="token" type="password" label="Bearer token" autoComplete="off" required maxLength={1500} />
      ) : null}
      <p className="text-xs text-graphite">Solo se permiten direcciones HTTPS públicas. MarchaSolo limita cada petición a esta URL base y bloquea redirecciones.</p>
      <FormMessage error={state.error} message={state.message} />
      <div className="sm:max-w-60"><SubmitButton pendingLabel="Guardando…">Guardar conexión API</SubmitButton></div>
    </form>
  )
}

function DisconnectForm({ workspaceId, provider, title }: { workspaceId: string; provider: Provider; title: string }) {
  const [state, action, pending] = useActionState<ApiConnectionState, FormData>(disconnectApiConnection, {})
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-rule pt-4" onSubmit={(event) => {
      if (!window.confirm(`¿Desconectar ${title}? Se borrará el secreto guardado en MarchaSolo.`)) event.preventDefault()
    }}>
      <input type="hidden" name="workspace_id" value={workspaceId} />
      <input type="hidden" name="provider" value={provider} />
      <FormMessage error={state.error} message={state.message} />
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : `Desconectar ${title}`}
      </button>
    </form>
  )
}
