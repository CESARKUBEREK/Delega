import Link from "next/link"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"
import { PLANS } from "@/lib/pricing"
import { SignupForm } from "./signup-form"

export const metadata = {
  title: "Crear cuenta",
  description:
    "Crea tu cuenta de MarchaSolo sin coste. Cuéntale una tarea y mira el plan que te prepara antes de conectar nada.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/crear-cuenta" },
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const sp = await searchParams
  const planId = typeof sp.plan === "string" ? sp.plan : undefined
  const plan = PLANS.find((p) => p.id === planId)

  return (
    <Sheet
      title="Crea tu cuenta"
      intro={
        plan
          ? `Has elegido ${plan.name} (${plan.price}${plan.period}). Sin coste al empezar y sin tarjeta: en dos minutos le cuentas tu primera tarea.`
          : "Sin coste y sin tarjeta. En dos minutos estás contándole tu primera tarea."
      }
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
        <SignupForm initialPlan={plan?.id} />
      </Suspense>
    </Sheet>
  )
}
