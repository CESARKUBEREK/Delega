"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"

const STORAGE_KEY = "delega:invite"

function read(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY)
    return token && /^[0-9a-f]{64}$/.test(token) ? token : null
  } catch {
    return null
  }
}

// Si la persona llegó desde un enlace de invitación y tuvo que entrar, crear
// cuenta o recuperar la contraseña, al volver le recordamos que la acepte.
export function PendingInviteNotice() {
  const token = useSyncExternalStore(
    () => () => {},
    read,
    () => null,
  )
  if (!token) return null

  return (
    <div role="status" className="mb-8 flex flex-col gap-3 border border-stroke bg-sheet px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ink">Tienes una invitación a una organización pendiente de aceptar.</p>
      <Link href="/invite" className="flex h-10 items-center justify-center bg-stroke px-4 font-semibold text-stroke-ink">
        Ver invitación
      </Link>
    </div>
  )
}
