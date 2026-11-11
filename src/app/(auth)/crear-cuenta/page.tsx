import Link from "next/link"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"
import { PLANS } from "@/lib/pricing"
import { publicPageMetadata } from "@/lib/seo"
import { SignupForm } from "./signup-form"

export const metadata = publicPageMetadata({
  title: "Crear cuenta",
  description:
    "Crea una cuenta de MarchaSolo sin costo. Indica qué conviene mejorar en el negocio o descubre oportunidades antes de conectar las aplicaciones.",
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
      title="Crear cuenta"
      intro={
        plan
          ? `Plan seleccionado: ${plan.name} (${plan.price}${plan.period}). Inicio sin costo y sin tarjeta. Indica qué conviene mejorar en el negocio.`
          : "Sin costo y sin tarjeta. Indica qué conviene mejorar; si aún no está definido, es posible descubrir oportunidades durante el proceso."
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
    <Sheet title="Crear cuenta" intro="Sin costo y sin tarjeta. Indica qué conviene mejorar; si aún no está definido, es posible descubrir oportunidades durante el proceso." story="signup">
      <div className="h-96" aria-busy="true" />
    </Sheet>
  )
}

function SignupFooter() {
  return (
    <>
      ¿Ya existe una cuenta?{" "}
      <Link href="/entrar" className="text-link underline underline-offset-4">
        Entrar
      </Link>
    </>
  )
}
