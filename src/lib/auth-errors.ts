// Traduce los códigos de error de Supabase Auth a mensajes que dicen qué
// pasó y cómo resolverlo. Los mensajes de acceso son deliberadamente
// genéricos para no revelar si un correo está registrado.
const MESSAGES: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña no son correctos.",
  email_not_confirmed: "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.",
  weak_password: "La contraseña es demasiado débil. Usa al menos 10 caracteres y evita contraseñas comunes.",
  same_password: "La nueva contraseña debe ser distinta de la anterior.",
  over_email_send_rate_limit: "Se han enviado demasiados correos. Espera unos minutos e inténtalo de nuevo.",
  over_request_rate_limit: "Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.",
  captcha_failed: "No se pudo verificar que eres una persona. Recarga la página e inténtalo de nuevo.",
  signup_disabled: "El registro está cerrado en este momento.",
  email_address_invalid: "Ese correo no es válido.",
  validation_failed: "Revisa los datos del formulario.",
  session_not_found: "Tu sesión ha caducado. Vuelve a entrar.",
  otp_expired: "El enlace ha caducado o ya se usó. Pide uno nuevo.",
}

export function authErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || "No se pudo completar la operación. Inténtalo de nuevo en unos minutos."
}
