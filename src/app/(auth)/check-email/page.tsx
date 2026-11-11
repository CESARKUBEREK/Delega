import Link from "next/link"
import { Sheet } from "@/components/sheet"

export const metadata = { title: "Confirmación de correo electrónico" }

export default function CheckEmailPage() {
  return (
    <Sheet
      title="Confirmar correo electrónico"
      sheetName="Alta"
      footer={
        <Link href="/entrar" className="text-link underline underline-offset-4">
          Iniciar sesión
        </Link>
      }
    >
      <p className="text-ink">Se ha enviado un enlace para confirmar la dirección de correo electrónico. Ábrelo para activar la cuenta.</p>
      <p className="mt-3 text-graphite">
        Si el mensaje no aparece en unos minutos, revisar la carpeta de correo no deseado. Si ya existe una cuenta con esa dirección, iniciar sesión.
      </p>
    </Sheet>
  )
}
