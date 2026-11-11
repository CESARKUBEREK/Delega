import Link from "next/link"
import { Sheet } from "@/components/sheet"

export const metadata = { title: "No se pudo entrar" }

export default function AuthErrorPage() {
  return (
    <Sheet
      title="No se pudo completar el acceso"
      sheetName="Acceso"
      footer={
        <Link href="/entrar" className="text-link underline underline-offset-4">
          Volver a entrar
        </Link>
      }
    >
      <p className="text-ink">El enlace ha caducado, ya se utilizó o el inicio de sesión fue cancelado.</p>
      <p className="mt-3 text-graphite">
        Iniciar sesión nuevamente. Si el enlace proviene de un correo de confirmación o recuperación, solicitar uno nuevo desde la pantalla de acceso.
      </p>
    </Sheet>
  )
}
