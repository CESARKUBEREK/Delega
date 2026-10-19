import Link from "next/link"
import { Suspense } from "react"
import { Sheet } from "@/components/sheet"

export const metadata = { title: "Conexión con Google" }

const MESSAGES: Record<string, string> = {
  denied: "Cancelaste la conexión en Google. No se ha guardado nada.",
  invalid_state: "La conexión caducó o se inició desde otra sesión. Vuelve a intentarlo desde Integraciones.",
  scope_denied: "Hace falta permitir el acceso a las planillas que elijas. Vuelve a conectar y marca esa casilla en Google.",
  no_refresh_token: "Google no devolvió un permiso duradero. Vuelve a intentarlo.",
  forbidden: "Solo un administrador del espacio puede conectar Google.",
  not_configured: "La conexión con Google aún no está configurada en el servidor.",
}

export default function GoogleResultPage({ searchParams }: PageProps<"/integraciones/google">) {
  return (
    <Sheet title="Conexión con Google" sheetName="Integraciones" footer={<Link href="/w" className="text-stroke underline underline-offset-4">Volver a tus espacios</Link>}>
      <Suspense fallback={<p className="text-graphite">Comprobando…</p>}>
        <Message searchParams={searchParams} />
      </Suspense>
    </Sheet>
  )
}

async function Message({ searchParams }: Pick<PageProps<"/integraciones/google">, "searchParams">) {
  const { e } = await searchParams
  const code = typeof e === "string" ? e : "invalid"
  return (
    <p role="alert" className="border-l-2 border-alert bg-alert-bg px-3 py-2 text-sm text-alert">
      {MESSAGES[code] ?? "No se pudo completar la conexión con Google. Inténtalo de nuevo desde Integraciones."}
    </p>
  )
}
