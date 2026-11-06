"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { checkOnboardingAi, trackOnboardingStep } from "@/app/w/[workspaceId]/onboarding/actions"

export function AiStep({
  workspaceId,
  base,
  isAdmin,
  cards,
  fromTrial,
  error: finishError,
  pending,
  lastStep,
  stepLabel,
  onBack,
  onContinue,
  onFinishDraft,
}: {
  workspaceId: string
  base: string
  isAdmin: boolean
  cards: { recommended: ReactNode; others: ReactNode }
  fromTrial: boolean
  error: string | null
  pending: boolean
  lastStep: boolean
  stepLabel: string
  onBack: () => void
  onContinue: () => void
  onFinishDraft: () => void
}) {
  const [status, setStatus] = useState<"loading" | "connected" | "missing">("loading")
  const [label, setLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, startCheck] = useTransition()
  const recommendedBox = useRef<HTMLDivElement>(null)

  const check = useCallback(async () => {
    const result = await checkOnboardingAi(workspaceId).catch(() => null)
    // Si no se puede comprobar, se enseñan las tarjetas igualmente.
    if (!result) {
      setStatus((s) => (s === "loading" ? "missing" : s))
      return
    }
    if (!result.ok) {
      setError(result.error)
      setStatus((s) => (s === "loading" ? "missing" : s))
      return
    }
    setError(null)
    setLabel(result.label)
    setStatus((s) => (result.connected ? "connected" : s === "loading" ? "missing" : s))
  }, [workspaceId])

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

  useEffect(() => {
    if (status === "connected") void trackOnboardingStep(workspaceId, "ai_connected")
  }, [status, workspaceId])

  // La tarjeta recomendada, abierta: el botón a la web del proveedor a la vista.
  useEffect(() => {
    if (status !== "missing") return
    const card = recommendedBox.current?.querySelector<HTMLDetailsElement>("details.integration-accordion")
    if (card && !card.open) card.open = true
  }, [status])

  const next = lastStep ? (pending ? "Guardando…" : "Terminar →") : "Continuar →"

  return (
    <section className="setup-panel flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-graphite">{stepLabel}</p>
        <h2 className="rotulo text-xl mt-1">Conecta tu IA</h2>
        <p className="text-graphite mt-1">
          Es el motor de MarchaSolo: con ella lee, ordena y redacta. Usas tu propia cuenta de IA: pagas allí, directamente al proveedor, solo
          lo que uses. Una automatización como la de tu plan suele costar unos céntimos por ejecución, y puedes fijar un presupuesto.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-graphite" role="status">
          Comprobando tu IA…
        </p>
      ) : status === "connected" ? (
        <div className="rounded-2xl border border-ok bg-paper p-5 flex flex-col gap-3" role="status">
          <p className="font-medium text-ink">✓ {label ? `${label} está conectada` : "Tu IA está conectada"}</p>
          <button
            type="button"
            onClick={onContinue}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-stroke px-5 font-semibold text-stroke-ink disabled:opacity-60"
          >
            {next}
          </button>
        </div>
      ) : isAdmin ? (
        <div className="flex flex-col gap-3">
          <ol className="grid gap-2 text-sm text-graphite sm:grid-cols-3">
            <li className="rounded-xl border border-rule bg-paper p-3">
              <strong className="block text-ink">1. Abre la web del proveedor</strong>
              Con el botón de la tarjeta, en otra pestaña. Crea la cuenta si no la tienes.
            </li>
            <li className="rounded-xl border border-rule bg-paper p-3">
              <strong className="block text-ink">2. Carga saldo y crea una clave</strong>
              Sin saldo, la clave no funciona. Copia la clave al crearla: solo se ve una vez.
            </li>
            <li className="rounded-xl border border-rule bg-paper p-3">
              <strong className="block text-ink">3. Vuelve y pégala aquí</strong>
              MarchaSolo la comprueba y la guarda cifrada. Tu progreso te espera aquí.
            </li>
          </ol>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">
              Recomendada: Anthropic
              <span className="font-normal text-graphite">
                {fromTrial ? " · es la IA que te ha preparado el plan" : " · da muy buenos resultados redactando y razonando"}
              </span>
            </p>
            <div ref={recommendedBox} className="setup-cards flex flex-col gap-3">
              {cards.recommended}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink">
              ¿Ya tienes otra? <span className="font-normal text-graphite">Sirve cualquiera. DeepSeek es la más económica.</span>
            </p>
            <div className="setup-cards flex flex-col gap-3">{cards.others}</div>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => startCheck(check)}
              disabled={checking}
              className="font-semibold text-link underline underline-offset-4 disabled:opacity-60"
            >
              {checking ? "Comprobando…" : "Ya la conecté, comprobar"}
            </button>
            <Link href={`${base}/integraciones#llms`} className="text-graphite underline underline-offset-4">
              Abrir en Integraciones
            </Link>
          </p>
          {error && <p className="text-sm text-alert">{error}</p>}
        </div>
      ) : (
        <p className="rounded-2xl border border-rule bg-paper p-5 text-sm text-graphite">
          Solo un administrador del espacio puede conectar la IA. Pídeselo; mientras tanto puedes seguir.
        </p>
      )}

      {finishError && <p className="text-sm text-alert">{finishError}</p>}

      <div className="flex flex-col gap-3">
        {status !== "connected" ? (
          <button
            type="button"
            onClick={onFinishDraft}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink px-5 font-medium text-ink disabled:opacity-60"
          >
            {pending ? "Guardando…" : "Guardar el plan como borrador y terminar"}
          </button>
        ) : null}
        <p className="text-xs text-graphite">
          Sin tu IA no se ejecuta nada. El plan no se pierde: puedes conectar la clave cuando quieras.
        </p>
        <button type="button" onClick={onBack} className="text-sm text-graphite">
          ← Volver al plan
        </button>
      </div>
    </section>
  )
}
