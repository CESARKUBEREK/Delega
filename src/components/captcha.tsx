"use client"

import { useEffect, useRef, useState } from "react"

// CAPTCHA de Cloudflare Turnstile para los formularios de acceso (registro,
// entrada y contraseña olvidada). Supabase Auth comprueba el token con su
// secreto (Authentication → Attack Protection → CAPTCHA). Sin
// NEXT_PUBLIC_TURNSTILE_SITE_KEY no se pinta nada y todo funciona como antes.
//
// El token sirve una sola vez: `resetKey` cambia tras cada envío (el estado
// del formulario) y el widget pide uno nuevo.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let loading: Promise<Turnstile> | null = null
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = SCRIPT_SRC
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")))
    s.onerror = () => {
      loading = null
      reject(new Error("turnstile"))
    }
    document.head.appendChild(s)
  })
  return loading
}

export const captchaEnabled = SITE_KEY !== ""

export function Captcha({ resetKey }: { resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState("")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!SITE_KEY || !box.current) return
    let cancelled = false
    loadTurnstile()
      .then((t) => {
        if (cancelled || !box.current || widget.current) return
        widget.current = t.render(box.current, {
          sitekey: SITE_KEY,
          language: "es",
          appearance: "interaction-only",
          callback: (value: string) => setToken(value),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        })
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [])

  // Tras cada envío, el token ya se ha gastado: pedir otro.
  useEffect(() => {
    if (widget.current && window.turnstile) {
      window.turnstile.reset(widget.current)
      setToken("")
    }
  }, [resetKey])

  if (!SITE_KEY) return null
  return (
    <div>
      <input type="hidden" name="captcha_token" value={token} />
      <div ref={box} />
      {failed ? (
        <p className="text-sm text-alert" role="alert">
          No se pudo cargar la comprobación de seguridad. Desactiva el bloqueador de contenido para esta página o recárgala.
        </p>
      ) : null}
    </div>
  )
}
