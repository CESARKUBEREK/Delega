import Link from "next/link"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"
import { LoginForm } from "./login-form"

export const metadata = {
  title: "Entrar",
  description: "Accede al espacio de MarchaSolo.",
  alternates: { canonical: "/entrar" },
}

export default function LoginPage() {
  return (
    <Sheet
      title="Iniciar sesión en MarchaSolo"
      footer={
        <>
          ¿Aún no existe una cuenta?{" "}
          <Link href="/crear-cuenta" className="text-link underline underline-offset-4">
            Crear cuenta
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormPlaceholder />}>
        <LoginForm />
      </Suspense>
    </Sheet>
  )
}

function FormPlaceholder() {
  return <div className="h-72" aria-busy="true" />
}
