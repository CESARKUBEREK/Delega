"use client"

import Link from "next/link"
import { useActionState } from "react"
import { useSearchParams } from "next/navigation"
import { Divider, Field, FormMessage, SubmitButton } from "@/components/form"
import { safeNext } from "@/lib/safe-redirect"
import { signIn, type FormState } from "../actions"
import { GoogleButton } from "../google-button"

export function LoginForm() {
  const next = safeNext(useSearchParams().get("next"))
  const [state, action] = useActionState<FormState, FormData>(signIn, {})

  return (
    <>
      <GoogleButton next={next} />
      <Divider>o con tu correo</Divider>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field id="email" name="email" type="email" label="Correo" autoComplete="email" required defaultValue={state.email} />
        <Field id="password" name="password" type="password" label="Contraseña" autoComplete="current-password" required />
        <FormMessage error={state.error} />
        <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-link underline underline-offset-4">
          He olvidado mi contraseña
        </Link>
      </p>
    </>
  )
}
