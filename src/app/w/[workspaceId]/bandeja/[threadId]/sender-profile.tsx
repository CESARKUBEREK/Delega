"use client"

import { useEffect, useState } from "react"
import { type SenderProfile, senderProfile } from "../inbox-actions"

// Ficha del remitente (fase 6G-3): HubSpot y Xubio. Se carga al abrir la
// conversación, sin bloquear el resto de la página.
export function SenderProfileCard({ workspaceId, threadId }: { workspaceId: string; threadId: string }) {
  const [profile, setProfile] = useState<SenderProfile | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    senderProfile(workspaceId, threadId)
      .then((p) => {
        if (alive) setProfile(p)
      })
      .catch(() => {
        if (alive) setProfile(null)
      })
    return () => {
      alive = false
    }
  }, [workspaceId, threadId])

  if (profile === undefined) return <p className="text-sm text-graphite" aria-busy="true">Buscando en tus aplicaciones…</p>
  if (!profile || (!profile.hubspotConnected && !profile.xubioConnected)) {
    return <p className="text-sm text-graphite">Conecta HubSpot o Xubio para ver aquí lo que ya sabes de esta persona.</p>
  }
  const hs = profile.hubspot
  return (
    <div className="flex flex-col gap-3 text-sm">
      {profile.hubspotConnected ? (
        hs ? (
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-ink">
              HubSpot:{" "}
              {hs.contact.url ? (
                <a href={hs.contact.url} target="_blank" rel="noreferrer" className="text-link underline underline-offset-4">
                  {hs.contact.name}
                </a>
              ) : (
                hs.contact.name
              )}
            </p>
            {hs.company ? <p className="text-graphite">Empresa: {hs.company.name}</p> : null}
            {hs.contact.phone ? <p className="text-graphite">Teléfono: {hs.contact.phone}</p> : null}
            {hs.deals.length ? (
              <ul className="mt-1 flex flex-col gap-1">
                {hs.deals.map((d, i) => (
                  <li key={i} className="border-l-2 border-stroke pl-2">
                    <span className="text-ink">{d.name}</span>
                    <span className="text-graphite">
                      {d.stage ? ` · ${d.stage}` : ""}
                      {d.amount ? ` · ${d.amount}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-graphite">Sin negocios abiertos.</p>
            )}
          </div>
        ) : (
          <p className="text-graphite">No está en HubSpot.</p>
        )
      ) : null}
      {profile.xubioConnected ? <p className="text-graphite">{profile.xubio ? `Xubio: cliente «${profile.xubio.name}».` : "No está entre tus clientes de Xubio."}</p> : null}
    </div>
  )
}
