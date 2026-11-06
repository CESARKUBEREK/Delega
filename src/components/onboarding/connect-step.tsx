"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { CONNECTION_ANCHOR, type OnboardingConnection } from "@/lib/onboarding"
import { checkOnboardingConnection, trackOnboardingStep } from "@/app/w/[workspaceId]/onboarding/actions"

// Paso 4: comprueba si ya está conectado lo que hace falta y, si no, enseña
// aquí mismo la tarjeta de conexión (la misma que en Integraciones). Vuelve a
// comprobar sola cada pocos segundos, al volver a la pestaña y al volver de
// Google (la cookie ms_setup trae de vuelta a esta página).
export function ConnectStep({
  workspaceId,
  base,
  needed,
  label,
  card,
  error: finishError,
  pending,
  stepLabel,
  onBack,
  onContinue,
}: {
  workspaceId: string
  base: string
  needed: OnboardingConnection
  label: string
  card: ReactNode
  error: string | null
  pending: boolean
  stepLabel: string
  onBack: () => void
  onContinue: () => void
}) {
  const [status, setStatus] = useState<"loading" | "connected" | "missing" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [checking, startCheck] = useTransition()
  const box = useRef<HTMLDivElement>(null)

  // Comprobación silenciosa: no cambia la pantalla salvo que ya esté conectado,
  // para no borrar lo que se esté escribiendo en la tarjeta.
  const check = useCallback(async () => {
    const result = await checkOnboardingConnection({ workspaceId, connection: needed }).catch(() => null)
    if (!result) {
      setError("No se pudo comprobar la conexión. Inténtalo de nuevo.")
      setStatus("error")
      return
    }
    if (!result.ok) {
      setError(result.error)
      setStatus("error")
      return
    }
    setError(null)
    setStatus(result.connected ? "connected" : "missing")
  }, [workspaceId, needed])

  useEffect(() => {
    const first = window.setTimeout(() => void check(), 0)
    const id = window.setInterval(() => void check(), 8000)
    const onFocus = () => void check()
    window.addEventListener("focus", onFocus)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [check])

  // Si Google se abre desde aquí, que vuelva a esta página (30 minutos).
  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; secure" : ""
    document.cookie = `ms_setup=${encodeURIComponent(`${workspaceId}:onboarding`)}; path=/; max-age=1800; samesite=lax${secure}`
  }, [workspaceId])

  useEffect(() => {
    if (status === "connected") void trackOnboardingStep(workspaceId, "connected", { needed })
  }, [status, workspaceId, needed])

  // Las tarjetas de Integraciones vienen plegadas: abrir la primera.
  useEffect(() => {
    if (status !== "missing") return
    const first = box.current?.querySelector<HTMLDetailsElement>("details.integration-accordion")
    if (first && !first.open) first.open = true
  }, [status])

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">{stepLabel}</p>
        <h2 className="rotulo text-xl mt-1">Solo falta una cosa</h2>
        <p className="text-graphite mt-1">
          Para este plan necesito acceso a <strong>{label}</strong>. {card ? "Conéctalo aquí mismo; el resto puede esperar." : "Abre Integraciones para configurarlo; el resto puede esperar."}
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-graphite" role="status">
          Comprobando la conexión…
        </p>
      ) : status === "error" ? (
        <div className="flex flex-col gap-3" role="alert">
          <p className="text-sm text-alert">{error}</p>
          <button type="button" onClick={() => startCheck(check)} disabled={checking} className="text-sm font-semibold text-link underline underline-offset-4">
            {checking ? "Comprobando…" : "Volver a comprobar"}
          </button>
        </div>
      ) : status === "connected" ? (
        <div className="rounded-2xl border border-ok bg-paper p-5 flex flex-col gap-3" role="status">
          <p className="font-medium text-ink">✓ {label} está conectado</p>
          <button
            type="button"
            onClick={onContinue}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Terminar →"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div ref={box} className="setup-cards">
            {card}
          </div>
          <p className="text-xs text-graphite">
            Tus credenciales se guardan cifradas y puedes desconectar cuando quieras. MarchaSolo nunca envía ni escribe nada sin tu aprobación.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => startCheck(check)}
              disabled={checking}
              className="font-semibold text-link underline underline-offset-4 disabled:opacity-60"
            >
              {checking ? "Comprobando…" : "Ya lo conecté, comprobar"}
            </button>
            <Link href={`${base}/integraciones#${CONNECTION_ANCHOR[needed]}`} className="text-graphite underline underline-offset-4">
              Abrir en Integraciones
            </Link>
          </p>
          {error && <p className="text-sm text-alert">{error}</p>}
        </div>
      )}

      {finishError && <p className="text-sm text-alert">{finishError}</p>}

      <div className="flex flex-wrap gap-3">
        {status !== "connected" ? (
          <button type="button" onClick={onContinue} disabled={pending} className="text-sm font-semibold text-link underline underline-offset-4">
            Lo conecto más tarde
          </button>
        ) : null}
        <button type="button" onClick={onBack} className="text-sm text-graphite">
          ← Volver a tu IA
        </button>
      </div>
    </section>
  )
}
