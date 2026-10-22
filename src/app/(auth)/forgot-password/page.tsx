"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Field, FormMessage, SubmitButton } from "@/components/form"
import { Sheet } from "@/components/sheet"
import { requestPasswordReset, type FormState } from "../actions"

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {})

  return (
    <Sheet
      title="Recupera el acceso"
      sheetName="Contraseña"
      footer={
        <Link href="/login" className="text-link underline underline-offset-4">
          Volver a entrar
        </Link>
      }
    >
      <p className="mb-5 text-graphite">Te enviaremos un enlace para crear una contraseña nueva. Caduca en una hora.</p>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Field id="email" name="email" type="email" label="Correo" autoComplete="email" required defaultValue={state.email} />
        <FormMessage error={state.error} message={state.message} />
        <SubmitButton pendingLabel="Enviando…">Enviar enlace</SubmitButton>
      </form>
    </Sheet>
  )
}
