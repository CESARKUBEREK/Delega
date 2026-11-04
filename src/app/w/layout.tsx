// Las rutas de espacios dependen de la sesión Supabase en cookies.
// Deben renderizarse por petición: durante el prerender, el SDK de Auth usa
// Date.now() para cargar la sesión y Next.js bloquea ese acceso dinámico.
export const dynamic = "force-dynamic"

// Cada vista de /w pone su propia barra superior (la lista de espacios y cada
// espacio), para que nunca se muestren dos.
export default function WorkspacesLayout({ children }: LayoutProps<"/w">) {
  return children
}
