import type { Enums } from "@/lib/supabase/database.types"

export const ROLE_LABEL: Record<Enums<"workspace_role">, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
}

export const KIND_LABEL: Record<Enums<"workspace_kind">, string> = {
  personal: "Espacio personal",
  organization: "Organización",
}
