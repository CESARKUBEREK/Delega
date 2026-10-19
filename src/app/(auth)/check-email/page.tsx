import Link from "next/link"
import { Sheet } from "@/components/sheet"

export const metadata = { title: "Confirma tu correo" }

export default function CheckEmailPage() {
  return (
    <Sheet
      title="Revisa tu correo"
      sheetName="Alta"
      footer={
        <Link href="/login" className="text-stroke underline underline-offset-4">
          Ir a entrar
        </Link>
      }
    >
      <p className="text-ink">Te hemos enviado un enlace para confirmar tu dirección. Ábrelo para activar la cuenta.</p>
      <p className="mt-3 text-graphite">
        Si no lo ves en unos minutos, mira en la carpeta de correo no deseado. Si ya tenías cuenta con ese correo, entra
        directamente.
      </p>
    </Sheet>
  )
}
