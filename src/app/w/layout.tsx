import Link from "next/link"
import { Suspense } from "react"
import { signOut } from "@/app/(auth)/actions"
import { Logo } from "@/components/logo"
import { requireUser } from "@/lib/auth"
import { PendingInviteNotice } from "./pending-invite-notice"

export default function WorkspacesLayout({ children }: LayoutProps<"/w">) {
  return (
    <div className="app-shell min-h-dvh">
      <header className="app-topbar">
        <div className="app-topbar-inner">
          <Link href="/w" aria-label="Orkesta, inicio">
            <Logo size={30} id="orkesta-header" />
          </Link>
          <Suspense fallback={<span className="h-5 w-40" />}>
            <Account />
          </Suspense>
        </div>
      </header>
      <main className="app-frame app-workspaces-page">
        <PendingInviteNotice />
        {children}
      </main>
    </div>
  )
}

async function Account() {
  const user = await requireUser()
  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="hidden text-graphite sm:inline">{user.email}</span>
      <form action={signOut}>
        <button type="submit" className="text-link underline underline-offset-4">
          Salir
        </button>
      </form>
    </div>
  )
}

