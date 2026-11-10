"use client"

import Link from "next/link"
import { useActionState, useState } from "react"
import { Field, FormMessage, SubmitButton } from "@/components/form"
import { byteLength, MAX_PAGE_BYTES, MAX_TITLE_CHARS } from "@/lib/pages"
import { type PageFormState, savePage } from "../page-actions"

export function PageEditor({ workspaceId, pageId, title, content, cancelHref }: { workspaceId: string; pageId: string; title: string; content: string; cancelHref: string }) {
  const [state, action] = useActionState<PageFormState, FormData>(savePage, {})
  const [text, setText] = useState(content)
  const kb = Math.ceil(byteLength(text) / 1024)
  const tooBig = byteLength(text) > MAX_PAGE_BYTES
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="pageId" value={pageId} />
      <Field id="page-title" name="title" label="Título" defaultValue={title} maxLength={MAX_TITLE_CHARS} required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="page-content" className="text-sm font-medium text-ink">Contenido</label>
        <textarea
          id="page-content"
          name="content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={20}
          aria-describedby="page-content-size"
          className="border border-rule bg-sheet p-3 font-mono text-sm text-ink focus:border-link focus:outline-none focus-visible:outline-2 focus-visible:outline-stroke"
        />
        <p id="page-content-size" className={`text-xs ${tooBig ? "text-alert" : "text-graphite"}`}>
          {kb} KB de {MAX_PAGE_BYTES / 1024} KB. Si la automatización vuelve a actualizar una sección, reemplaza lo que hayas escrito en ella.
        </p>
      </div>
      <FormMessage error={state.error} message={state.message} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-full sm:w-auto"><SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton></div>
        <Link href={cancelHref} className="text-link underline underline-offset-4">Cancelar</Link>
      </div>
    </form>
  )
}
