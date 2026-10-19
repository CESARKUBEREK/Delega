import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { KIND_LABEL, ROLE_LABEL } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"
import { revokeInvitation } from "../actions"
import { InviteForm } from "./invite-form"
import { DeleteForm, LeaveForm, RenameForm } from "./manage-panel"

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
  const isOrg = workspace.kind === "organization"
  const canInvite = isOrg && (myRole === "owner" || myRole === "admin")
  const isOwner = isOrg && myRole === "owner"
  const ownerCount = (members ?? []).filter((m) => m.role === "owner" && m.status === "active").length
  // El último propietario no puede salir (lo impide también la base de datos).
  const canLeave = isOrg && !(myRole === "owner" && ownerCount <= 1)

  // Invitaciones pendientes: la RLS solo las devuelve a admins y propietarios.
  const { data: pending } = canInvite
    ? await supabase
        .from("invitations")
        .select("id, email, role, expires_at")
        .eq("workspace_id", workspaceId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [] }

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

        {canInvite && pending && pending.length > 0 ? (
          <div className="mt-8 border border-ink bg-sheet">
            <h2 className="border-b border-ink px-5 py-3 font-semibold">Invitaciones pendientes</h2>
            <ul className="divide-y divide-rule">
              {pending.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span>
                    <span className="block text-ink">{inv.email}</span>
                    <span className="text-sm text-graphite">
                      {ROLE_LABEL[inv.role]}, caduca el {formatDate(inv.expires_at)}
                    </span>
                  </span>
                  <form action={revokeInvitation}>
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button type="submit" className="text-sm text-alert underline underline-offset-4">
                      Revocar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 max-w-prose text-sm text-graphite">
          El asistente, las automatizaciones, las integraciones y el historial de este espacio llegarán en las próximas fases.
        </p>

        {isOrg ? (
          <div className="mt-10 flex flex-col gap-8 border-t border-rule pt-8">
            {canInvite ? (
              <section>
                <h2 className="rotulo mb-4 text-lg">Nombre de la organización</h2>
                <RenameForm workspaceId={workspace.id} name={workspace.name} />
              </section>
            ) : null}
            {canLeave ? (
              <section>
                <h2 className="rotulo mb-2 text-lg">Salir</h2>
                <LeaveForm workspaceId={workspace.id} />
              </section>
            ) : null}
            {isOwner ? (
              <section>
                <h2 className="rotulo mb-2 text-lg text-alert">Borrar la organización</h2>
                <DeleteForm workspaceId={workspace.id} name={workspace.name} />
              </section>
            ) : null}
          </div>
        ) : null}
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

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" }).format(new Date(iso))
}
