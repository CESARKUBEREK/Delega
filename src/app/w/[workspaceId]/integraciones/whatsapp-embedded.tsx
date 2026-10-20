"use client"

import { useEffect, useRef, useState } from "react"
import { FormMessage } from "@/components/form"
import { connectWhatsAppEmbedded } from "../run-actions"

// Alta de WhatsApp Business con Embedded Signup de Meta (app de Delega como
// Tech Provider). Con "coexistencia", el número sigue funcionando en la app
// WhatsApp Business del móvil y Delega recibe lo que entra y lo que envías.

type FBLoginResponse = { authResponse?: { code?: string } | null; status?: string }
type FB = {
  init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void
  login(cb: (r: FBLoginResponse) => void, opts: Record<string, unknown>): void
}
declare global {
  interface Window {
    FB?: FB
    fbAsyncInit?: () => void
  }
}

let sdk: Promise<FB> | null = null
function loadSdk(appId: string): Promise<FB> {
  if (window.FB) return Promise.resolve(window.FB)
  sdk ??= new Promise<FB>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: false, xfbml: false, version: "v26.0" })
      resolve(window.FB!)
    }
    const s = document.createElement("script")
    s.src = "https://connect.facebook.net/es_ES/sdk.js"
    s.async = true
    s.crossOrigin = "anonymous"
    s.onerror = () => {
      sdk = null
      reject(new Error("sdk"))
    }
    document.body.appendChild(s)
  })
  return sdk
}

export function EmbeddedSignupButton({ workspaceId, appId, configId }: { workspaceId: string; appId: string; configId: string }) {
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<{ error?: string; message?: string }>({})
  const session = useRef<{ wabaId?: string; phoneNumberId?: string; coexistence?: boolean }>({})

  // Meta comunica el WABA y el número elegidos por postMessage desde su ventana.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      let host = ""
      try {
        host = new URL(event.origin).hostname
      } catch {
        return
      }
      if (host !== "facebook.com" && !host.endsWith(".facebook.com")) return
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return
        if (String(data.event).startsWith("FINISH")) {
          session.current = {
            wabaId: data.data?.waba_id,
            phoneNumberId: data.data?.phone_number_id,
            coexistence: data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
          }
        } else if (data.event === "CANCEL") {
          session.current = {}
        }
      } catch {
        // mensajes de Meta que no son del alta
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  async function start(coexistence: boolean) {
    setBusy(true)
    setState({})
    session.current = {}
    let fb: FB
    try {
      fb = await loadSdk(appId)
    } catch {
      setState({ error: "No se pudo cargar el alta de Meta. Revisa los bloqueadores del navegador." })
      setBusy(false)
      return
    }
    fb.login(
      (response) => {
        const code = response.authResponse?.code
        // El postMessage de Meta puede llegar justo después del callback.
        setTimeout(async () => {
          const s = session.current
          if (!code || !s.wabaId) {
            setState({ error: "El alta no se completó en Meta. Vuelve a intentarlo." })
            setBusy(false)
            return
          }
          const result = await connectWhatsAppEmbedded({
            workspaceId,
            code,
            wabaId: s.wabaId,
            phoneNumberId: s.phoneNumberId ?? null,
            coexistence: s.coexistence ?? coexistence,
          })
          if (!result.ok) setState({ error: result.error })
          else {
            setState({
              message: `WhatsApp ${result.display ?? ""} conectado.${
                result.syncRequested ? " Meta está enviando tus contactos y el histórico de 6 meses: tardará unos minutos." : ""
              }`,
            })
          }
          setBusy(false)
        }, 800)
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: coexistence
          ? { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }
          : { setup: {}, sessionInfoVersion: "3" },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <FormMessage error={state.error} message={state.message} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => start(true)}
          className="h-11 bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Conectando…" : "Conectar mi WhatsApp Business"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => start(false)}
          className="h-11 border border-ink px-5 text-sm font-medium text-ink hover:bg-paper disabled:opacity-60"
        >
          Usar un número nuevo solo para la API
        </button>
      </div>
      <p className="text-xs text-graphite">
        «Mi WhatsApp Business» mantiene el número en la app del móvil (coexistencia): Delega recibe lo que entra, lo que
        envías y hasta 6 meses de histórico de chats individuales. Los grupos no se sincronizan.
      </p>
    </div>
  )
}
