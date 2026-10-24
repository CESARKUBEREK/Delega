// push: avisos al propio usuario.
// Acción "test": envía un aviso de prueba a todos sus dispositivos suscritos.
// (Los dispositivos se dan de alta desde el panel con la función SQL
// push_subscribe; los avisos reales los envía el agente al pedir aprobación.)
import { authenticate, fail, json } from "../_shared/core.ts"
import { pushConfigured, sendPush } from "../_shared/push.ts"

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Método no permitido.")
  const ctx = await authenticate(req)
  if (ctx instanceof Response) return ctx
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null

  if (body?.action === "test") {
    if (!(await pushConfigured())) return fail(409, "not_configured", "Los avisos aún no están configurados en el servidor.")
    const result = await sendPush(ctx.admin, [ctx.userId], {
      title: "Orkesta",
      body: "Los avisos funcionan en este dispositivo.",
      url: "/abrir",
      tag: "prueba",
    })
    if (!result.sent) return fail(404, "no_devices", "No hay ningún dispositivo con los avisos activados.")
    return json(result)
  }

  return fail(400, "bad_request", "Acción no válida.")
})
