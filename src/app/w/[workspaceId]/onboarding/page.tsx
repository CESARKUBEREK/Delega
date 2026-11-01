import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { OnboardingClient } from "./onboarding-client"

export const metadata = { title: "Empieza con MarchaSolo" }

export default function OnboardingPage({ params }: PageProps<"/w/[workspaceId]/onboarding">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-2xl border border-rule bg-sheet" aria-busy="true" />}>
      <Onboarding params={params} />
    </Suspense>
  )
}

async function Onboarding({ params }: { params: PageProps<"/w/[workspaceId]/onboarding">["params"] }) {
  const { workspaceId } = await params
  const { isAdmin, workspace, user } = await getWorkspace(workspaceId, `/w/${workspaceId}/onboarding`)
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0] ?? ""

  return (
    <OnboardingClient
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      isAdmin={isAdmin}
      userName={firstName}
    />
  )
}
