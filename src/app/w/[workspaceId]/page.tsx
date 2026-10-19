import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { KIND_LABEL, ROLE_LABEL } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"
import { InviteForm } from "./invite-form"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const metadata = { title: "Espacio" }

export default function WorkspacePage({ params }: PageProps<"/w/[workspaceId]">) {
  return (
    <Suspense fallback={<div className="h-64 border border-rule bg-sheet" aria-busy="true" />}>
      <Workspace params={params} />
    </Suspense>
  )
}

async function Workspace({ params }: { params: PageProps<"/w/[workspaceId]">["params"] }) {
  const { workspaceId } = await params
  if (!UUID_RE.test(workspaceId)) notFound()

  const user = await requireUser(`/w/${workspaceId}`)
  const supabase = await createClient()

  // La RLS solo devuelve el espacio si el usuario es miembro activo.
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, kind")
    .eq("id", workspaceId)
    .maybeSingle()
  if (!workspace) notFound()

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, role, status")
    .eq("workspace_id", workspaceId)
    .order("created_at")

  const ids = (members ?? []).map((m) => m.user_id)
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] }
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]))

  const myRole = members?.find((m) => m.user_id === user.id)?.role
  const canInvite = workspace.kind === "organization" && (myRole === "owner" || myRole === "admin")

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section>
        <p className="text-sm">
          <Link href="/w" className="text-stroke underline underline-offset-4">
            Tus espacios
          </Link>
        </p>
        <h1 className="rotulo mt-3 text-3xl">{workspace.name}</h1>
        <p className="mt-1 text-graphite">
          {KIND_LABEL[workspace.kind]}
          {myRole ? `, eres ${ROLE_LABEL[myRole].toLowerCase()}` : ""}
        </p>

        <div className="mt-8 border border-ink bg-sheet">
          <h2 className="border-b border-ink px-5 py-3 font-semibold">Miembros</h2>
          <ul className="divide-y divide-rule">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-ink">
                  {nameById.get(m.user_id) || "Sin nombre"}
                  {m.user_id === user.id ? <span className="text-graphite"> (tú)</span> : null}
                </span>
                <span className="text-sm text-graphite">
                  {ROLE_LABEL[m.role]}
                  {m.status === "suspended" ? ", suspendido" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 max-w-prose text-sm text-graphite">
          El asistente, las automatizaciones, las integraciones y el historial de este espacio llegarán en las próximas fases.
        </p>
      </section>

      {canInvite ? (
        <aside className="h-fit border border-ink bg-sheet p-6">
          <h2 className="rotulo text-lg">Invitar a alguien</h2>
          <p className="mt-1 mb-5 text-sm text-graphite">Tendrá que entrar con el mismo correo al que le invitas.</p>
          <InviteForm workspaceId={workspace.id} />
        </aside>
      ) : null}
    </div>
  )
}
