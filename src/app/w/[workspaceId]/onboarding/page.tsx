import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getWorkspace } from "@/lib/workspace"
import { AiCard } from "../integraciones/ai-card"
import { DriveCard } from "../integraciones/google-card"
import { ImapCard } from "../integraciones/inbox-cards"
import { CalendarCard } from "../integraciones/work-cards"
import { HelpPanel } from "@/components/help-panel"
import { OnboardingClient } from "./onboarding-client"

export const metadata = { title: "Empieza con MarchaSolo" }

export default function OnboardingPage({ params, searchParams }: PageProps<"/w/[workspaceId]/onboarding">) {
  return (
    <Suspense fallback={<div className="h-96 rounded-2xl border border-rule bg-sheet" aria-busy="true" />}>
      <Onboarding params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function Onboarding({ params, searchParams }: Pick<PageProps<"/w/[workspaceId]/onboarding">, "params" | "searchParams">) {
  const { workspaceId } = await params
  const sp = await searchParams
  // Aviso de vuelta de Google (Drive o Calendar), como en Integraciones.
  const googleNotice = sp.google === "conectado" ? "connected" : typeof sp.google_error === "string" ? sp.google_error : null
  const { isAdmin, workspace, user } = await getWorkspace(workspaceId, `/w/${workspaceId}/onboarding`)
  const supabase = await createClient()
  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
  const firstName = (profile?.display_name ?? "").trim().split(/\s+/)[0] ?? ""

  return (
    <>
      <HelpPanel workspaceId={workspaceId} page="onboarding" />
      <OnboardingClient
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        isAdmin={isAdmin}
        userName={firstName}
        aiCards={
          <>
            {(["anthropic", "openai", "deepseek", "xai"] as const).map((provider) => (
              <AiCard key={provider} workspaceId={workspaceId} isAdmin={isAdmin} provider={provider} />
            ))}
          </>
        }
        cards={{
          email: <ImapCard workspaceId={workspaceId} isAdmin={isAdmin} />,
          spreadsheet: <DriveCard workspaceId={workspaceId} isAdmin={isAdmin} notice={googleNotice} />,
          calendar: <CalendarCard workspaceId={workspaceId} isAdmin={isAdmin} notice={sp.calendar === "conectado"} />,
        }}
      />
    </>
  )
}
