"use client"

import { useEffect, useRef, type ReactNode } from "react"

// Abre la primera tarjeta del paso (las de Integraciones vienen plegadas) y
// recuerda, durante 30 minutos, que el usuario está en el asistente: al
// volver de Google, la app lo trae de nuevo a este paso.
export function SetupStepBody({ workspaceId, step, children }: { workspaceId: string; step: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLDetailsElement>("details.integration-accordion:not([open])")
    if (first && !ref.current?.querySelector("details.integration-accordion[open]")) first.open = true
  }, [step])

  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; secure" : ""
    document.cookie = `ms_setup=${encodeURIComponent(`${workspaceId}:${step}`)}; path=/; max-age=1800; samesite=lax${secure}`
  }, [workspaceId, step])

  return (
    <div ref={ref} className="setup-cards">
      {children}
    </div>
  )
}

// Al terminar o al saltar el asistente, deja de devolver a él.
export function ForgetSetup() {
  useEffect(() => {
    document.cookie = "ms_setup=; path=/; max-age=0; samesite=lax"
  }, [])
  return null
}
