"use client"

import { useState, useTransition } from "react"
import { InfoBanner } from "@/components/ui"
import { linkInboxThreadContact, searchInboxContacts, unlinkInboxThreadContact } from "../inbox-actions"

type Contact = { id: string; name: string; email: string }
type Association = { id: string; confirmed_at: string; contact: Contact }

export function ThreadContactAssociation({ workspaceId, threadId, association }: {
  workspaceId: string
  threadId: string
  association: Association | null
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Contact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, startTransition] = useTransition()

  function search() {
    startTransition(async () => {
      setError(null)
      setNotice(null)
      const result = await searchInboxContacts(workspaceId, query)
      if (result.ok) setResults(result.contacts)
      else setError(result.error)
    })
  }

  return (
    <section className="mt-4 border-t border-rule pt-3" aria-labelledby="verified-contact-title">
      <h3 id="verified-contact-title" className="mb-2 text-sm font-semibold text-ink">Contacto asociado</h3>
      {association ? (
        <div className="flex flex-col gap-2">
          <div className="text-sm">
            <p className="font-semibold text-ink">{association.contact.name}</p>
            <p className="text-graphite">{association.contact.email}</p>
            <p className="mt-1 text-xs text-graphite">Asociación confirmada el {new Date(association.confirmed_at).toLocaleDateString("es-ES")}</p>
          </div>
          <button type="button" disabled={busy} onClick={() => {
            if (!window.confirm("¿Desvincular este contacto? El registro de la asociación se conservará.")) return
            startTransition(async () => {
              setError(null); setNotice(null)
              const result = await unlinkInboxThreadContact(workspaceId, threadId, association.id)
              if (result.ok) setNotice(result.message ?? "Contacto desvinculado.")
              else setError(result.error)
            })
          }} className="self-start border border-rule px-3 py-2 text-xs text-ink hover:bg-paper disabled:opacity-50">
            {busy ? "Procesando…" : "Desvincular contacto"}
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs text-graphite">No hay una asociación confirmada. Busca un contacto y selecciónalo expresamente; coincidir en email o teléfono no lo asocia automáticamente.</p>
          <div className="flex gap-2">
            <label htmlFor="contact-search" className="sr-only">Buscar contacto</label>
            <input id="contact-search" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); search() } }} maxLength={100} placeholder="Nombre o email" className="h-10 min-w-0 flex-1 border border-rule bg-sheet px-3 text-sm text-ink" />
            <button type="button" disabled={busy || query.trim().length < 2} onClick={search} className="h-10 border border-ink px-3 text-sm text-ink disabled:opacity-50">{busy ? "…" : "Buscar"}</button>
          </div>
          {results.length ? (
            <ul className="mt-2 flex flex-col divide-y divide-rule border border-rule">
              {results.map(contact => <li key={contact.id} className="flex items-center justify-between gap-2 p-2">
                <div className="min-w-0 text-sm"><p className="truncate font-medium text-ink">{contact.name}</p><p className="truncate text-xs text-graphite">{contact.email}</p></div>
                <button type="button" disabled={busy} onClick={() => startTransition(async () => {
                  setError(null); setNotice(null)
                  const result = await linkInboxThreadContact(workspaceId, threadId, contact.id)
                  if (result.ok) setNotice(result.message ?? "Contacto asociado.")
                  else setError(result.error)
                })} className="shrink-0 border border-ink px-2 py-1 text-xs text-ink hover:bg-paper disabled:opacity-50">Asociar</button>
              </li>)}
            </ul>
          ) : query.trim().length >= 2 && !busy ? <p className="mt-2 text-xs text-graphite">No hay resultados. Pulsa Buscar para consultar los contactos del espacio.</p> : null}
        </>
      )}
      {error ? <InfoBanner tone="danger" role="alert" className="mt-2">{error}</InfoBanner> : null}
      {notice ? <InfoBanner tone="success" role="status" className="mt-2">{notice} Actualiza la página para ver el estado actualizado.</InfoBanner> : null}
    </section>
  )
}
