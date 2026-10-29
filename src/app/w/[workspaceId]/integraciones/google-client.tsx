"use client"

import { useActionState, useState } from "react"
import { FormMessage } from "@/components/form"
import { addPickedFiles, disconnectGoogle, googlePickerToken, type ActionResult } from "../run-actions"

// Tipos mínimos del selector de Google (se carga desde apis.google.com).
type PickerDoc = { id: string; name?: string }
type PickerData = { action: string; docs?: PickerDoc[] }
type PickerBuilder = {
  addView(view: unknown): PickerBuilder
  enableFeature(feature: unknown): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setAppId(id: string): PickerBuilder
  setLocale(locale: string): PickerBuilder
  setTitle(title: string): PickerBuilder
  setCallback(cb: (data: PickerData) => void): PickerBuilder
  build(): { setVisible(v: boolean): void }
}
type DocsView = { setIncludeFolders(v: boolean): DocsView; setSelectFolderEnabled(v: boolean): DocsView; setParent(id: string): DocsView }
type GooglePicker = {
  PickerBuilder: new () => PickerBuilder
  DocsView: new (viewId?: unknown) => DocsView
  ViewId: { SPREADSHEETS: unknown; DOCUMENTS: unknown; DOCS: unknown; FOLDERS: unknown }
  Feature: { MULTISELECT_ENABLED: unknown }
  Action: { PICKED: string; CANCEL: string }
}
declare global {
  interface Window {
    gapi?: { load(name: string, cb: () => void): void }
    google?: { picker?: GooglePicker }
  }
}

let pickerLoad: Promise<GooglePicker> | null = null

function loadPicker(): Promise<GooglePicker> {
  if (window.google?.picker) return Promise.resolve(window.google.picker)
  pickerLoad ??= new Promise<GooglePicker>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://apis.google.com/js/api.js"
    script.async = true
    script.onload = () => window.gapi!.load("picker", () => (window.google?.picker ? resolve(window.google.picker) : reject(new Error("picker"))))
    script.onerror = () => {
      pickerLoad = null
      reject(new Error("script"))
    }
    document.head.appendChild(script)
  })
  return pickerLoad
}

export function PickSheetsButton({
  workspaceId,
  apiKey,
  appId,
  label = "Elegir archivos o carpetas",
}: {
  workspaceId: string
  apiKey: string
  appId: string
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ error?: string; message?: string }>({})

  async function open() {
    setBusy(true)
    setMessage({})
    try {
      const [picker, tokenResult] = await Promise.all([loadPicker(), googlePickerToken(workspaceId)])
      if (!tokenResult.token) {
        setMessage({ error: tokenResult.error ?? "No se pudo abrir el selector." })
        setBusy(false)
        return
      }
      new picker.PickerBuilder()
        .addView(new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(true).setSelectFolderEnabled(true))
        .addView(new picker.DocsView(picker.ViewId.FOLDERS).setSelectFolderEnabled(true))
        .addView(picker.ViewId.SPREADSHEETS)
        .addView(picker.ViewId.DOCUMENTS)
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .setOAuthToken(tokenResult.token)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setLocale("es")
        .setTitle("Elige los archivos y carpetas que Marcha Solo puede usar")
        .setCallback(async (data) => {
          if (data.action === picker.Action.CANCEL) {
            setBusy(false)
            return
          }
          if (data.action !== picker.Action.PICKED) return
          const result = await addPickedFiles(workspaceId, (data.docs ?? []).map((d) => ({ id: d.id })))
          if (result.error) setMessage({ error: result.error })
          else {
            const added = result.added?.length ?? 0
            const skipped = result.skipped?.length ?? 0
            setMessage({
              message: `${added} elemento(s) añadido(s).${skipped ? ` ${skipped} se omitieron (formularios, dibujos u otros tipos que Marcha Solo no sabe leer).` : ""}`,
            })
          }
          setBusy(false)
        })
        .build()
        .setVisible(true)
    } catch {
      setMessage({ error: "No se pudo cargar el selector de Google. Revisa tu conexión o los bloqueadores del navegador." })
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <FormMessage error={message.error} message={message.message} />
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="h-11 w-fit bg-stroke px-5 text-base font-semibold text-stroke-ink hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? "Abriendo selector…" : label}
      </button>
    </div>
  )
}

export function DisconnectGoogleForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(disconnectGoogle, null)
  return (
    <form
      action={action}
      className="flex flex-col gap-2 border-t border-rule pt-4"
      onSubmit={(e) => {
        if (!window.confirm("¿Desconectar Google Drive? Marcha Solo pierde el acceso y se olvidan los archivos y carpetas elegidos.")) e.preventDefault()
      }}
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {state && !state.ok ? <FormMessage error={state.error} /> : null}
      <button type="submit" disabled={pending} className="w-fit text-sm text-alert underline underline-offset-4 disabled:opacity-60">
        {pending ? "Desconectando…" : "Desconectar Google Drive"}
      </button>
    </form>
  )
}
