"use client"

import Link from "next/link"
import { useSyncExternalStore } from "react"

// ¿Hay sesión en este navegador? Solo es una pista para elegir los enlaces
// (la cookie de Supabase Auth existe); el acceso de verdad lo decide el
// servidor. En el servidor y en el primer render, «sin sesión».
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/

function subscribe(onChange: () => void) {
  window.addEventListener("focus", onChange)
  return () => window.removeEventListener("focus", onChange)
}

export function useSignedInHint(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => SESSION_COOKIE.test(document.cookie),
    () => false,
  )
}

// Enlaces de cuenta del pie: entrar y crear cuenta, o ir a tu espacio.
export function FooterAccountLinks() {
  const signedIn = useSignedInHint()
  return signedIn ? (
    <span className="flex gap-5">
      <Link href="/abrir">Ir a mi espacio</Link>
    </span>
  ) : (
    <span className="flex gap-5">
      <Link href="/entrar">Entrar</Link>
      <Link href="/crear-cuenta">Crear cuenta</Link>
    </span>
  )
}
