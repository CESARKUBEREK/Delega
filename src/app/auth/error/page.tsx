import Link from "next/link"
import { Sheet } from "@/components/sheet"

export const metadata = { title: "No se pudo entrar" }

export default function AuthErrorPage() {
  return (
    <Sheet
      title="No se pudo completar el acceso"
      sheetName="Acceso"
      footer={
        <Link href="/login" className="text-stroke underline underline-offset-4">
          Volver a entrar
        </Link>
      }
    >
      <p className="text-ink">El enlace ha caducado, ya se usó o el inicio de sesión se canceló.</p>
      <p className="mt-3 text-graphite">
        Vuelve a entrar. Si venías de un correo de confirmación o de recuperación, pide uno nuevo desde la pantalla de acceso.
      </p>
    </Sheet>
  )
}
