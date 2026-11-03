import Link from "next/link"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"
import { PLANS } from "@/lib/pricing"
import { publicPageMetadata } from "@/lib/seo"
import { SignupForm } from "./signup-form"

export const metadata = publicPageMetadata({
  title: "Crear cuenta",
  description:
    "Crea tu cuenta de MarchaSolo sin coste. Cuéntale una tarea y mira el plan que te prepara antes de conectar nada.",
  path: "/crear-cuenta",
})

type SignupPageProps = { searchParams: Promise<{ plan?: string | string[] }> }

export default function SignupPage({ searchParams }: SignupPageProps) {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupContent searchParams={searchParams} />
    </Suspense>
  )
}

async function SignupContent({ searchParams }: SignupPageProps) {
  const { plan: planId } = await searchParams
  const plan = typeof planId === "string" ? PLANS.find((item) => item.id === planId) : undefined

  return (
    <Sheet
      title="Crea tu cuenta"
      intro={
        plan
          ? `Has elegido ${plan.name} (${plan.price}${plan.period}). Sin coste al empezar y sin tarjeta: en dos minutos le cuentas tu primera tarea.`
          : "Sin coste y sin tarjeta. En dos minutos estás contándole tu primera tarea."
      }
      story="signup"
      footer={<SignupFooter />}
    >
      <SignupForm initialPlan={plan?.id} />
    </Sheet>
  )
}

function SignupPageFallback() {
  return (
    <Sheet title="Crea tu cuenta" intro="Sin coste y sin tarjeta. En dos minutos estás contándole tu primera tarea." story="signup">
      <div className="h-96" aria-busy="true" />
    </Sheet>
  )
}

function SignupFooter() {
  return (
    <>
      ¿Ya tienes cuenta?{" "}
      <Link href="/entrar" className="text-link underline underline-offset-4">
        Entrar
      </Link>
    </>
  )
}
