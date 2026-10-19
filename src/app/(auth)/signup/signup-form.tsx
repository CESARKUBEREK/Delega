"use client"

import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { Divider, Field, FormMessage, SubmitButton } from "@/components/form"
import { safeNext } from "@/lib/safe-redirect"
import { signUp, type FormState } from "../actions"
import { GoogleButton } from "../google-button"

export function SignupForm() {
  const next = safeNext(useSearchParams().get("next"))
  const [state, action] = useActionState<FormState, FormData>(signUp, {})

  return (
    <>
      <GoogleButton next={next} />
      <Divider>o con tu correo</Divider>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field id="name" name="name" type="text" label="Nombre" autoComplete="name" maxLength={120} />
        <Field id="email" name="email" type="email" label="Correo" autoComplete="email" required defaultValue={state.email} />
        <Field
          id="password"
          name="password"
          type="password"
          label="Contraseña"
          autoComplete="new-password"
          minLength={10}
          required
          hint="Al menos 10 caracteres. Una frase corta es más segura que una palabra con símbolos."
        />
        <FormMessage error={state.error} />
        <SubmitButton pendingLabel="Creando cuenta…">Crear cuenta</SubmitButton>
      </form>
    </>
  )
}
