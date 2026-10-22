// google-connection: conecta cuentas de Google a un espacio.
//   * product "drive" (provider "google"): permiso drive.file, solo las planillas
//     y documentos que el usuario elige con el selector.
//   * product "gmail" (provider "gmail"): leer el correo y enviar respuestas.
//   * product "calendar" (provider "calendar"): leer la agenda y crear eventos.
// Acciones: start, callback, picker_token, add_files, remove_file, disconnect.
// Solo owners y admins. El refresh token se guarda cifrado en Vault.
import { authenticate, fail, isUuid, json, membershipRole, type AuthContext } from "../_shared/core.ts"
import {
  accessTokenFrom,
  authorizationUrl,
  driveFile,
  emailFromIdToken,
  exchangeCode,
  GoogleError,
  GOOGLE_SCOPES,
  googleConfigured,
  pkceChallenge,
  randomToken,
  redirectUri,
  revokeToken,
  sha256Hex,
  DOCUMENT_MIME,
  FOLDER_MIME,
  SPREADSHEET_MIME,
} from "../_shared/google.ts"

const SLIDES = "application/vnd.google-apps.presentation"
import { GMAIL_SCOPES } from "../_shared/gmail.ts"
import { CALENDAR_REQUIRED, CALENDAR_SCOPES, primaryTimezone } from "../_shared/calendar.ts"

type Provider = "google" | "gmail" | "calendar"
const PRODUCTS: Record<Provider, { scopes: string[]; required: string[]; denied: string; deniedMessage: string }> = {
  google: {
    scopes: GOOGLE_SCOPES,
    required: ["https://www.googleapis.com/auth/drive.file"],
    denied: "scope_denied",
    deniedMessage: "Hace falta permitir el acceso a los archivos que elijas. Vuelve a conectar y marca esa casilla.",
  },
  gmail: {
    scopes: GMAIL_SCOPES,
    required: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"],
    denied: "gmail_scope_denied",
    deniedMessage: "Hace falta permitir leer y enviar correo. Vuelve a conectar y marca las dos casillas.",
  },
  calendar: {
    scopes: CALENDAR_SCOPES,
    required: CALENDAR_REQUIRED,
    denied: "calendar_scope_denied",
    deniedMessage: "Hace falta permitir ver y editar los eventos del calendario. Vuelve a conectar y marca esa casilla.",
  },
}
function productOf(v: unknown): Provider {
  return v === "gmail" ? "gmail" : v === "calendar" ? "calendar" : "google"
}

const MAX_FILES_PER_WORKSPACE = 100

async function requireAdmin(ctx: AuthContext, workspaceId: unknown): Promise<Response | string> {
  if (!isUuid(workspaceId)) return fail(400, "bad_request", "Espacio no válido.")
  const role = await membershipRole(ctx, workspaceId)
  if (role !== "owner" && role !== "admin") {
    return fail(403, "forbidden", "Solo un administrador puede gestionar las conexiones de este espacio.")
  }
  return workspaceId
}

async function refreshTokenFor(ctx: AuthContext, workspaceId: string) {
  const { data } = await ctx.admin.rpc("integration_secret", { p_workspace_id: workspaceId, p_provider: "google" })
  return data?.[0] as { integration_id: string; refresh_token: string; status: string; account_email: string | null } | undefined
}

function googleFail(e: unknown): Response {
  if (e instanceof GoogleError) {
    if (e.code === "invalid_grant") return fail(409, "google_revoked", "Google ha retirado el acceso. Vuelve a conectar tu cuenta.")
    return fail(502, `google_${e.code}`, e.message)
  }
  return fail(500, "internal", "Algo ha fallado al hablar con Google.")
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  if (!googleConfigured()) return fail(503, "not_configured", "La conexión con Google aún no está configurada en el servidor.")

  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const action = body?.action

  // ---------------------------------------------------------------------------
  // 1. Empezar: crea el estado PKCE y devuelve la URL de consentimiento.
  // ---------------------------------------------------------------------------
  if (action === "start") {
    const ws = await requireAdmin(ctx, body?.workspace_id)
    if (ws instanceof Response) return ws
    const provider = productOf(body?.product)

    const state = randomToken(32)
    const verifier = randomToken(48)
    await ctx.admin.from("oauth_states").delete().lt("expires_at", new Date().toISOString())
    const { error } = await ctx.admin.from("oauth_states").insert({
      state_hash: await sha256Hex(state),
      workspace_id: ws,
      user_id: ctx.userId,
      provider,
      code_verifier: verifier,
      redirect_uri: redirectUri(),
    })
    if (error) return fail(500, "db_error", "No se pudo iniciar la conexión.")
    return json({ url: authorizationUrl(state, await pkceChallenge(verifier), PRODUCTS[provider].scopes) })
  }

  // ---------------------------------------------------------------------------
  // 2. Volver de Google: canjea el código y guarda el refresh token.
  // ---------------------------------------------------------------------------
  if (action === "callback") {
    const state = typeof body?.state === "string" ? body.state : ""
    const code = typeof body?.code === "string" ? body.code : ""
    if (!state || !code || state.length > 200 || code.length > 2000) return fail(400, "bad_request", "Respuesta de Google no válida.")

    // El estado es de un solo uso: se borra al leerlo.
    const { data: rows } = await ctx.admin
      .from("oauth_states")
      .delete()
      .eq("state_hash", await sha256Hex(state))
      .select("workspace_id, user_id, code_verifier, expires_at, provider")
    const row = rows?.[0]
    if (!row || row.user_id !== ctx.userId || new Date(row.expires_at) < new Date()) {
      return fail(400, "invalid_state", "La conexión caducó o no se inició desde esta sesión. Vuelve a intentarlo.")
    }
    const ws = await requireAdmin(ctx, row.workspace_id)
    if (ws instanceof Response) return ws

    let tokens
    try {
      tokens = await exchangeCode(code, row.code_verifier)
    } catch (e) {
      return googleFail(e)
    }
    const provider = productOf(row.provider)
    const product = PRODUCTS[provider]
    const granted = (tokens.scope ?? "").split(" ")
    if (!product.required.every((r) => granted.includes(r))) {
      if (tokens.refresh_token) await revokeToken(tokens.refresh_token)
      return fail(400, product.denied, product.deniedMessage)
    }
    if (!tokens.refresh_token) {
      return fail(400, "no_refresh_token", "Google no devolvió un permiso duradero. Vuelve a conectar.")
    }

    const email = emailFromIdToken(tokens.id_token)
    const { error } = await ctx.admin.rpc("integration_save", {
      p_workspace_id: ws,
      p_provider: provider,
      p_refresh_token: tokens.refresh_token,
      p_account_email: email,
      p_scopes: granted.join(" "),
      p_actor: ctx.userId,
    })
    if (error) return fail(500, "save_failed", "No se pudo guardar la conexión.")
    if (provider === "gmail") {
      // Conserva categorías y conservación si ya existían; la sincronización empieza de cero.
      const { data: prev } = await ctx.admin.from("integrations").select("config").eq("workspace_id", ws).eq("provider", "gmail").maybeSingle()
      const config = (prev?.config ?? {}) as Record<string, unknown>
      await ctx.admin.rpc("integration_set_config", {
        p_workspace_id: ws,
        p_provider: "gmail",
        p_config: { ...config, email, history_id: null },
      })
    }
    if (provider === "calendar") {
      const tz = tokens.access_token ? await primaryTimezone(tokens.access_token) : null
      await ctx.admin.rpc("integration_set_config", {
        p_workspace_id: ws,
        p_provider: "calendar",
        p_config: { email, timezone: tz ?? "Europe/Madrid" },
      })
    }
    return json({ ok: true, workspace_id: ws, provider })
  }

  const ws = await requireAdmin(ctx, body?.workspace_id)
  if (ws instanceof Response) return ws

  // ---------------------------------------------------------------------------
  // 3. Token de corta duración para el selector de Google (navegador).
  //    Con drive.file solo sirve para las planillas elegidas.
  // ---------------------------------------------------------------------------
  if (action === "picker_token") {
    const secret = await refreshTokenFor(ctx, ws)
    if (!secret) return fail(409, "no_connection", "Primero conecta tu cuenta de Google.")
    try {
      const { token, expiresIn } = await accessTokenFrom(secret.refresh_token)
      return json({ access_token: token, expires_in: expiresIn })
    } catch (e) {
      if (e instanceof GoogleError && e.code === "invalid_grant") {
        await ctx.admin.rpc("integration_mark_invalid", { p_workspace_id: ws, p_provider: "google" })
      }
      return googleFail(e)
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Registrar las planillas elegidas (se comprueban con Drive).
  // ---------------------------------------------------------------------------
  if (action === "add_files") {
    const files = Array.isArray(body?.files) ? body.files : []
    const ids = [...new Set(files.map((f) => (f && typeof f === "object" ? (f as { id?: unknown }).id : null)))]
      .filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{10,200}$/.test(id))
      .slice(0, 20)
    if (!ids.length) return fail(400, "bad_request", "No se eligió ningún archivo.")

    const secret = await refreshTokenFor(ctx, ws)
    if (!secret) return fail(409, "no_connection", "Primero conecta tu cuenta de Google.")
    const { count } = await ctx.admin
      .from("integration_files")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws)
    if ((count ?? 0) + ids.length > MAX_FILES_PER_WORKSPACE) {
      return fail(400, "too_many", `Un espacio puede tener como máximo ${MAX_FILES_PER_WORKSPACE} archivos.`)
    }

    let token: string
    try {
      token = (await accessTokenFrom(secret.refresh_token)).token
    } catch (e) {
      return googleFail(e)
    }

    const added: string[] = []
    const skipped: string[] = []
    for (const id of ids) {
      try {
        const file = await driveFile(token, id)
        if (file.mimeType.startsWith("application/vnd.google-apps.") && ![SPREADSHEET_MIME, DOCUMENT_MIME, FOLDER_MIME, SLIDES].includes(file.mimeType)) {
          // Formularios, dibujos, sitios…: Delega no sabe leerlos.
          skipped.push(file.name)
          continue
        }
        const { error } = await ctx.admin.from("integration_files").upsert(
          {
            workspace_id: ws,
            integration_id: secret.integration_id,
            provider_file_id: file.id,
            name: file.name.slice(0, 300) || "Archivo sin nombre",
            mime_type: file.mimeType,
            url: file.webViewLink?.slice(0, 1000) ?? null,
            added_by: ctx.userId,
          },
          { onConflict: "integration_id,provider_file_id" },
        )
        if (!error) added.push(file.name)
      } catch {
        skipped.push(id)
      }
    }
    return json({ ok: true, added, skipped })
  }

  if (action === "remove_file") {
    if (!isUuid(body?.file_id)) return fail(400, "bad_request", "Planilla no válida.")
    await ctx.admin.from("integration_files").delete().eq("id", body.file_id).eq("workspace_id", ws)
    return json({ ok: true })
  }

  // ---------------------------------------------------------------------------
  // 5. Desconectar: revoca en Google y borra la conexión y el secreto.
  // ---------------------------------------------------------------------------
  if (action === "disconnect") {
    const provider = productOf(body?.product)
    const { data } = await ctx.admin.rpc("integration_secret", { p_workspace_id: ws, p_provider: provider })
    const secret = data?.[0] as { refresh_token: string } | undefined
    if (secret) await revokeToken(secret.refresh_token)
    const { error } = await ctx.admin.rpc("integration_delete", { p_workspace_id: ws, p_provider: provider, p_actor: ctx.userId })
    if (error) return fail(500, "delete_failed", "No se pudo desconectar Google.")
    return json({ ok: true })
  }

  return fail(400, "bad_request", "Acción no válida.")
})
