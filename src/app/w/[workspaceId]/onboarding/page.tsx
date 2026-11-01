import { Suspense } from "react"
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

  return (
    <OnboardingClient
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      isAdmin={isAdmin}
      userName={(user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? ""}
    />
  )
}
