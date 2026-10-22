import Link from "next/link"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"
import { SignupForm } from "./signup-form"

export const metadata = { title: "Crear cuenta" }

export default function SignupPage() {
  return (
    <Sheet
      title="Crea tu cuenta"
      sheetName="Alta"
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-link underline underline-offset-4">
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
