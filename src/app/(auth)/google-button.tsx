import { GoogleMark, SecondaryButton } from "@/components/form"
import { signInWithGoogle } from "./actions"

export function GoogleButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SecondaryButton pendingLabel="Abriendo Google…">
        <GoogleMark />
        Continuar con Google
      </SecondaryButton>
    </form>
  )
}
