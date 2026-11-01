"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"
import { loadOnboarding } from "@/lib/onboarding"

const noopSubscribe = () => () => {}

// En Integraciones: si hay un onboarding a medias en esta pestaña (por
// ejemplo, al volver de conectar Google), lleva de vuelta al plan.
export function OnboardingReturn({ workspaceId }: { workspaceId: string }) {
  const name = useSyncExternalStore(
    noopSubscribe,
    () => {
      const saved = loadOnboarding(workspaceId)
      return saved?.plan && saved.step !== "task" ? saved.plan.name : null
    },
    () => null,
  )
  if (!name) return null
  return (
    <p className="mt-3 rounded-xl border border-stroke bg-paper px-4 py-3 text-sm text-ink">
      Estabas preparando «{name}».{" "}
      <Link href={`/w/${workspaceId}/onboarding`} className="font-semibold text-link underline underline-offset-4">
        Volver a tu plan →
      </Link>
    </p>
  )
}
