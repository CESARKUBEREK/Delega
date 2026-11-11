"use client"

import { useActionState } from "react"
import { Field, FormMessage, SubmitButton } from "@/components/form"
import { Sheet } from "@/components/sheet"
import { updatePassword, type FormState } from "../actions"

export default function ResetPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {})

  return (
    <Sheet title="Crear una contraseña nueva" sheetName="Contraseña">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field
          id="password"
          name="password"
          type="password"
          label="Contraseña nueva"
          autoComplete="new-password"
          minLength={10}
          required
          hint="Mínimo 10 caracteres."
        />
        <Field id="confirm" name="confirm" type="password" label="Confirmar contraseña" autoComplete="new-password" required />
        <FormMessage error={state.error} />
        <SubmitButton pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
      </form>
    </Sheet>
  )
}
