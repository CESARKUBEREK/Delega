import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"
import { requireUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ConsentForm } from "./consent-form"

// A esta página llega Supabase Auth cuando un asistente (Claude, ChatGPT,
// Grok Bot…) pide conectarse con MarchaSolo por OAuth (fase 11).

export const metadata = { title: "Conectar un asistente", robots: { index: false } }

export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <Sheet title="Conectar un asistente">
      <Suspense fallback={<div className="h-72" aria-busy="true" />}>
        <Consent searchParams={searchParams} />
      </Suspense>
    </Sheet>
  )
}

async function Consent({ searchParams }: { searchParams: PageProps<"/oauth/consent">["searchParams"] }) {
  const params = await searchParams
  const authorizationId = typeof params.authorization_id === "string" ? params.authorization_id : ""
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(authorizationId)) {
    return <p className="text-sm text-ink">La solicitud no es válida. Vuelve a conectar MarchaSolo desde tu asistente.</p>
  }
  const user = await requireUser(`/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`)
  const supabase = await createClient()

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
  if (error || !details) {
    return <p className="text-sm text-ink">La solicitud caducó o ya se usó. Vuelve a conectar MarchaSolo desde tu asistente.</p>
  }
  // Ya lo había aprobado: vuelve directamente al asistente.
  if (!("authorization_id" in details)) redirect(details.redirect_url)

  // Espacios donde la persona es owner o admin (la bandeja es solo de ellos).
  const { data: memberships } = await supabase
    .from("memberships")
    .select("workspace_id, role, workspaces(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
  const workspaces = (memberships ?? [])
    .map((m) => ({ id: m.workspace_id, name: (m.workspaces as { name?: string } | null)?.name ?? "Espacio" }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  // Por defecto, el último espacio usado.
  const last = (await cookies()).get("orkesta_ws")?.value ?? null

  return (
    <ConsentForm
      authorizationId={authorizationId}
      clientName={details.client.name || "Un asistente"}
      clientUri={details.client.uri || null}
      email={user.email}
      workspaces={workspaces}
      preferredWorkspace={workspaces.some((w) => w.id === last) ? last : null}
    />
  )
}
