import Link from "next/link"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"
import { SignupForm } from "./signup-form"

export const metadata = {
  title: "Crear cuenta",
  description: "Crea tu cuenta de MarchaSolo sin coste. Cuéntale una tarea y mira el plan que te prepara antes de conectar nada.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/crear-cuenta" },
}

export default function SignupPage() {
  return (
    <Sheet
      title="Crea tu cuenta"
      intro="Sin coste y sin tarjeta. En dos minutos estás contándole tu primera tarea."
      story="signup"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="text-link underline underline-offset-4">
            Entrar
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-96" aria-busy="true" />}>
        <SignupForm />
      </Suspense>
    </Sheet>
  )
}
