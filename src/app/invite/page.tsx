"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Sheet } from "@/components/sheet"
import { acceptInvitation } from "@/app/w/actions"

const STORAGE_KEY = "delega:invite"

// El token llega en el fragmento (#token), que el navegador no envía al
// servidor. Si hace falta entrar antes, se guarda solo en esta pestaña.
function readToken(): string | null {
  const fromHash = window.location.hash.slice(1)
  if (/^[0-9a-f]{64}$/.test(fromHash)) {
    try {
      sessionStorage.setItem(STORAGE_KEY, fromHash)
    } catch {}
    history.replaceState(null, "", window.location.pathname)
    return fromHash
  }
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export default function InvitePage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string>()
  const [needsLogin, setNeedsLogin] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    // Lectura única del fragmento al montar: solo existe en el navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(readToken())
  }, [])

  function accept() {
    if (!token) return
    startTransition(async () => {
      const result = await acceptInvitation(token)
      if (result.needsLogin) return setNeedsLogin(true)
      if (result.error) return setError(result.error)
      try {
        sessionStorage.removeItem(STORAGE_KEY)
      } catch {}
      router.replace(`/w/${result.workspaceId}`)
    })
  }

  return (
    <Sheet title="Te han invitado a MarchaSolo" sheetName="Invitación">
      {token === undefined ? (
        <div className="h-24" aria-busy="true" />
      ) : token === null ? (
        <p className="text-ink">Este enlace de invitación no es válido. Pide a quien te invitó que te envíe uno nuevo.</p>
      ) : needsLogin ? (
        <div className="flex flex-col gap-4">
          <p className="text-ink">Para aceptar, entra o crea tu cuenta con el correo al que te invitaron.</p>
          <div className="flex gap-3">
            <Link href="/login?next=/invite" className="flex h-11 flex-1 items-center justify-center bg-stroke font-semibold text-stroke-ink">
              Entrar
            </Link>
            <Link href="/signup?next=/invite" className="flex h-11 flex-1 items-center justify-center border border-ink">
              Crear cuenta
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-ink">Al aceptar te unirás a la organización con el rol que te asignaron.</p>
          {error ? (
            <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={accept}
            disabled={pending}
            className="h-11 bg-stroke font-semibold text-stroke-ink disabled:opacity-70"
          >
            {pending ? "Aceptando…" : "Aceptar invitación"}
          </button>
        </div>
      )}
    </Sheet>
  )
}
