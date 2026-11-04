import { connection } from "next/server"

// Las rutas de espacios dependen de la sesión Supabase en cookies.
// Con Cache Components activo, connection() aplaza el renderizado hasta
// disponer de una petición real, sin usar la config dinámica incompatible.
export default async function WorkspacesLayout({ children }: LayoutProps<"/w">) {
  await connection()
  return children
}
