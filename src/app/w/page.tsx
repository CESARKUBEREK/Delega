import Link from "next/link"
import { Suspense } from "react"
import { requireUser } from "@/lib/auth"
import { KIND_LABEL, ROLE_LABEL } from "@/lib/labels"
import { createClient } from "@/lib/supabase/server"
import { CreateOrganization } from "./create-organization"

export const metadata = { title: "Tus espacios" }

export default function WorkspacesPage() {
  return (
    <div className="workspaces-grid grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section>
        <p className="app-eyebrow">TU ESPACIO DE TRABAJO</p>
        <h1 className="rotulo text-3xl">Tus espacios</h1>
        <p className="mt-2 max-w-prose text-graphite">
          Cada espacio guarda sus propios flujos, conexiones y claves. Lo que haces en uno no se ve en los demás.
        </p>
        <Suspense fallback={<div className="mt-6 h-40 border border-rule bg-sheet" aria-busy="true" />}>
          <WorkspaceList />
        </Suspense>
      </section>

      <aside className="workspaces-create-card h-fit border border-ink bg-sheet p-6">
        <h2 className="rotulo text-lg">Nueva organización</h2>
        <p className="mt-1 mb-5 text-sm text-graphite">
          Para trabajar con tu equipo: invitas a cada persona y le das un rol.
        </p>
        <CreateOrganization />
      </aside>
    </div>
  )
}

async function WorkspaceList() {
  const user = await requireUser("/w")
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("role, workspaces(id, name, kind)")
    .eq("user_id", user.id)
    .eq("status", "active")

  if (error) {
    return <p className="mt-6 text-alert">No se pudieron cargar tus espacios. Recarga la página.</p>
  }

  const rows = (data ?? [])
    .flatMap((m) => (m.workspaces ? [{ role: m.role, ...m.workspaces }] : []))
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "es") : a.kind === "personal" ? -1 : 1))

  return (
    <ul className="workspace-list mt-6 divide-y divide-rule border border-ink bg-sheet">
      {rows.map((w) => (
        <li key={w.id}>
          <Link href={`/w/${w.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-paper">
            <span>
              <span className="block font-medium text-ink">{w.name}</span>
              <span className="text-sm text-graphite">{KIND_LABEL[w.kind]}</span>
            </span>
            <span className="text-sm text-graphite">{ROLE_LABEL[w.role]}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

