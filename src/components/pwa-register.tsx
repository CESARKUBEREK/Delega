"use client"

import { useEffect } from "react"

// Registra el service worker (página sin conexión y avisos). En desarrollo no
// se registra, para no interferir con la recarga en caliente.
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined)
  }, [])
  return null
}
