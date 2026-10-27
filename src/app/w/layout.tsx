// Cada vista de /w pone su propia barra superior (la lista de espacios y cada
// espacio), para que nunca se muestren dos.
export default function WorkspacesLayout({ children }: LayoutProps<"/w">) {
  return children
}
