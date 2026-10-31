// Ficha del remitente en la bandeja (fase 6G-3): lo que el negocio ya sabe de
// esa persona en HubSpot y en Xubio. Solo lecturas y sin IA. La bandeja es de
// owners y admins, así que Xubio también se muestra.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { dealPipelines, getRecord, hubspotToken, recordLabel, search } from "./hubspot.ts"
import { xubioCredentials, xubioList, xubioToken } from "./xubio.ts"

export type SenderProfile = {
  hubspot: null | {
    contact: { name: string; email: string | null; phone: string | null; url: string | null }
    company: { name: string; url: string | null } | null
    deals: { name: string; stage: string | null; amount: string | null; url: string | null }[]
  }
  hubspotConnected: boolean
  xubio: null | { name: string }
  xubioConnected: boolean
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

export async function senderProfile(admin: SupabaseClient, workspaceId: string, address: string | null, role: string | null): Promise<SenderProfile> {
  const out: SenderProfile = { hubspot: null, hubspotConnected: false, xubio: null, xubioConnected: false }
  const email = (address ?? "").trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return out

  const [hs, xb] = await Promise.all([
    hubspotToken(admin, workspaceId).catch(() => null),
    role === "owner" || role === "admin" ? xubioCredentials(admin, workspaceId).catch(() => null) : Promise.resolve(null),
  ])

  if (hs) {
    out.hubspotConnected = true
    try {
      const found = (await search(hs.token, "contacts", email, 3, hs.config.portal_id)).find((r) => (r.properties.email ?? "").toLowerCase() === email)
      if (found) {
        const rec = await getRecord(hs.token, "contacts", found.id, hs.config.portal_id)
        const companyId = rec.associations.companies?.[0]
        const company = companyId ? await getRecord(hs.token, "companies", companyId, hs.config.portal_id).catch(() => null) : null
        const dealIds = (rec.associations.deals ?? []).slice(0, 3)
        const deals = (await Promise.all(dealIds.map((id) => getRecord(hs.token, "deals", id, hs.config.portal_id).catch(() => null)))).filter(Boolean)
        const stages = deals.length ? new Map((await dealPipelines(hs.token).catch(() => [])).flatMap((p) => p.stages.map((s) => [s.id, s.label] as const))) : new Map()
        out.hubspot = {
          contact: { name: recordLabel("contacts", rec.properties), email: rec.properties.email ?? null, phone: rec.properties.phone ?? null, url: rec.url },
          company: company ? { name: recordLabel("companies", company.properties), url: company.url } : null,
          deals: deals.map((d) => ({
            name: recordLabel("deals", d!.properties),
            stage: stages.get(d!.properties.dealstage ?? "") ?? d!.properties.dealstage ?? null,
            amount: d!.properties.amount ?? null,
            url: d!.url,
          })),
        }
      }
    } catch {
      // HubSpot no respondió: la ficha sale sin él.
    }
  }

  if (xb) {
    out.xubioConnected = true
    try {
      const token = await xubioToken(xb)
      const list = await xubioList(token, "clientes", { limit: 500 })
      const hit = list.items.find((c) => JSON.stringify(c).toLowerCase().includes(email)) as Record<string, unknown> | undefined
      if (hit) {
        const name = [hit.nombre, hit.razonSocial, hit.name].find((v) => typeof v === "string" && v.trim()) as string | undefined
        out.xubio = { name: name ?? "Cliente en Xubio" }
      }
    } catch {
      // Xubio no respondió.
    }
  }
  return out
}
