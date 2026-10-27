import { signOut } from "@/app/(auth)/actions"
import { requireUser } from "@/lib/auth"

// Cuenta en la barra superior: inicial, correo (en pantallas anchas) y Salir.
export async function AccountMenu() {
  const user = await requireUser()
  const email = user.email ?? ""
  return (
    <div className="app-account">
      <span className="app-account-avatar" aria-hidden="true">
        {(email.charAt(0) || "?").toUpperCase()}
      </span>
      <span className="app-account-email">{email}</span>
      <form action={signOut}>
        <button type="submit" className="app-account-exit">
          Salir
        </button>
      </form>
    </div>
  )
}
