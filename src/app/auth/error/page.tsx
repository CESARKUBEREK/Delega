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
      <p className="text-ink">El enlace ha caducado, ya se usó o el inicio de sesión se canceló.</p>
      <p className="mt-3 text-graphite">
        Intenta iniciar sesión nuevamente. Si el enlace provenía de un correo de confirmación o recuperación, solicita uno nuevo desde la pantalla de acceso.
      </p>
    </Sheet>
  )
}
