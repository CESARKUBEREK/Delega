// «Avisarme»: el agente avisa a la persona dueña de la ejecución (quien la
// lanzó o creó la automatización) sin pedir aprobación, porque el aviso es
// para ella misma. La IA no elige el destinatario: no es un parámetro.
//
// - Aviso push: solo el nombre de la automatización, nunca datos de clientes.
//   Al tocarlo se abre la ejecución, donde está el texto completo.
// - Correo a la dirección de su cuenta, por el buzón IMAP/SMTP del espacio,
//   con el texto completo. No se guarda en la bandeja.
// - Siempre queda en la ejecución (evento con el texto).
// - Máximo 3 avisos por ejecución y 30 al día por persona y espacio.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0"
import { imapAccount, sendViaSmtp } from "./imap.ts"
import { sendPush } from "./push.ts"

export const MAX_NOTICES_PER_RUN = 3
export const MAX_NOTICES_PER_DAY = 30
export const MAX_NOTICE_CHARS = 4000

type RunInfo = { id: string; workspace_id: string; flow_name: string; started_by: string | null }

export async function notifyMe(
  admin: SupabaseClient,
  run: RunInfo,
  input: { subject: string; text: string },
  mailActive: boolean,
): Promise<{ ok: true; channels: string[] } | { ok: false; error: string }> {
  const userId = run.started_by
  const text = input.text.trim().slice(0, MAX_NOTICE_CHARS)
  const subject = input.subject.replace(/[\r\n]+/g, " ").trim().slice(0, 150) || run.flow_name
  if (!userId) return { ok: false, error: "Esta ejecución no tiene una persona a la que avisar." }
  if (!text) return { ok: false, error: "Falta el texto del aviso." }

  const { count: inRun } = await admin
    .from("run_events")
    .select("id", { count: "exact", head: true })
    .eq("run_id", run.id)
    .eq("kind", "message")
    .not("detail->>notice_to", "is", null)
  if ((inRun ?? 0) >= MAX_NOTICES_PER_RUN) return { ok: false, error: `Ya se enviaron ${MAX_NOTICES_PER_RUN} avisos en esta ejecución.` }
  const { count: today } = await admin
    .from("run_events")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", run.workspace_id)
    .eq("kind", "message")
    .eq("detail->>notice_to", userId)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
  if ((today ?? 0) >= MAX_NOTICES_PER_DAY) return { ok: false, error: "Se alcanzó el límite de avisos de hoy." }

  const channels: string[] = []
  const push = await sendPush(admin, [userId], {
    title: run.flow_name.slice(0, 80),
    body: "Tienes un aviso nuevo de esta automatización.",
    url: `/w/${run.workspace_id}/ejecuciones/${run.id}`,
    tag: `notice-${run.id}`,
  }).catch(() => ({ sent: 0, failed: 0 }))
  if (push.sent > 0) channels.push("push")

  if (mailActive) {
    try {
      const { data } = await admin.auth.admin.getUserById(userId)
      const email = data?.user?.email
      if (email) {
        const { secret, config } = await imapAccount(admin, run.workspace_id)
        await sendViaSmtp(config.smtp_host, secret, {
          fromName: "Orkesta",
          from: config.email,
          to: email,
          subject,
          text: `${text}\n\n— Aviso de la automatización «${run.flow_name}» de Orkesta.`,
        })
        channels.push("correo")
      }
    } catch (e) {
      console.error("notify_me mail", e instanceof Error ? e.name : "error")
    }
  }

  await admin.from("run_events").insert({
    run_id: run.id,
    workspace_id: run.workspace_id,
    kind: "message",
    title: (channels.length ? `Aviso enviado a ti (${channels.join(" y ")}): ${subject}` : `Aviso para ti: ${subject}`).slice(0, 300),
    detail: { notice: text, notice_to: userId, channels },
  })
  return { ok: true, channels }
}
