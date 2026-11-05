// Regresiones del sistema de diseño compartido (src/app/globals.css).
// npm test -> node --test --experimental-strip-types tests/*.test.mjs
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")
const ui = readFileSync(new URL("../src/components/ui.tsx", import.meta.url), "utf8")
const plan = readFileSync(new URL("../src/lib/plan.ts", import.meta.url), "utf8")
const automation = readFileSync(new URL("../src/app/w/[workspaceId]/automatizaciones/page.tsx", import.meta.url), "utf8")
const history = readFileSync(new URL("../src/app/w/[workspaceId]/historial/page.tsx", import.meta.url), "utf8")
const workIntegrations = readFileSync(new URL("../src/app/w/[workspaceId]/integraciones/work-cards.tsx", import.meta.url), "utf8")
const inboxIntegrations = readFileSync(new URL("../src/app/w/[workspaceId]/integraciones/inbox-cards.tsx", import.meta.url), "utf8")
const replyComposer = readFileSync(new URL("../src/app/w/[workspaceId]/bandeja/[threadId]/reply-composer.tsx", import.meta.url), "utf8")
const runLive = readFileSync(new URL("../src/app/w/[workspaceId]/ejecuciones/[runId]/run-live.tsx", import.meta.url), "utf8")
const runPanel = readFileSync(new URL("../src/app/w/[workspaceId]/automatizaciones/[flowId]/run-panel.tsx", import.meta.url), "utf8")
const flowEditor = readFileSync(new URL("../src/app/w/[workspaceId]/automatizaciones/flow-editor.tsx", import.meta.url), "utf8")
const invitePage = readFileSync(new URL("../src/app/invite/page.tsx", import.meta.url), "utf8")
const googleCard = readFileSync(new URL("../src/app/w/[workspaceId]/integraciones/google-card.tsx", import.meta.url), "utf8")


function rule(selector) {
  const escaped = selector.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&")
  const match = css.match(new RegExp("(?:^|\\n)\\s*" + escaped + "\\s*\\{([^}]*)\\}"))
  assert.ok(match, "no se encontró la regla CSS " + selector)
  return match[1]
}

test("los tokens base de marca y estructura siguen definidos", () => {
  const root = css.match(/:root\s*\{([^}]*)\}/)
  assert.ok(root, "falta el bloque :root")
  for (const token of [
    "--paper", "--sheet", "--ink", "--graphite", "--turquesa", "--link",
    "--space-4", "--radius-md", "--border-subtle",
  ]) {
    assert.match(root[1], new RegExp("(?:^|\\s)" + token.replaceAll("-", "\\-") + "\\s*:"), "falta " + token)
  }
})

test("los botones compartidos conservan un foco visible", () => {
  const focus = rule(".ms-button:focus-visible")
  assert.match(focus, /outline\s*:\s*3px\s+solid\s+var\(--state-focus\)/)
  assert.match(focus, /outline-offset\s*:\s*3px/)
})

test("el campo de búsqueda compartido muestra foco en su contenedor", () => {
  const focus = rule(".ms-search-input:focus-within")
  assert.match(focus, /border-color\s*:\s*var\(--turquesa\)/)
  assert.match(focus, /outline\s*:\s*2px\s+solid\s+var\(--turquesa\)/)
  assert.match(focus, /outline-offset\s*:\s*2px/)
})

test("la interfaz respeta la preferencia de movimiento reducido", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/)
})


test("los encabezados y las tarjetas usan sus hooks de descripción correspondientes", () => {
  assert.ok(ui.includes('<h1 className="ms-page-header-title">{title}</h1>'))
  assert.ok(ui.includes('<p className="ms-page-header-description">{description}</p>'))
  assert.ok(ui.includes('<h2 className="ms-panel-card-title">{title}</h2>'))
  assert.ok(ui.includes('<p className="ms-panel-card-description">{description}</p>'))
  assert.ok(css.includes(".ms-page-header-description, .ms-panel-card-description {"))
})


test("Bandeja reduce el espacio entre secciones en móvil como el resto del espacio", () => {
  assert.ok(css.includes("@media (max-width:640px) {\n  .inbox-page { gap:16px; }"))
})

test("los estados de ejecución comparten etiquetas y tonos semánticos", () => {
  for (const [status, tone] of [
    ["running", "info"],
    ["awaiting_approval", "warning"],
    ["succeeded", "success"],
    ["failed", "danger"],
    ["cancelled", "neutral"],
  ]) {
    assert.match(plan, new RegExp(status + ': "' + tone + '"'))
  }
  assert.match(plan, /return RUN_STATUS_TONE\[status\] \?\? "neutral"/)
  assert.ok(ui.includes("export function RunStatusBadge("))
  assert.ok(ui.includes("tone={runStatusTone(status)}"))
})

test("Automatizaciones e Historial usan el mismo componente de estado", () => {
  assert.ok(automation.includes("<RunStatusBadge status={run.status}"))
  assert.ok(automation.includes('<RunStatusBadge status="awaiting_approval"'))
  assert.ok(history.includes("<RunStatusBadge status={r.status}"))
  assert.ok(!css.includes(".automation-activity-status.is-succeeded"))
  assert.ok(!css.includes(".automation-history-status.is-failed"))
})

test("las tarjetas de integraciones comparten la representación de conexión", () => {
  assert.ok(ui.includes("export function IntegrationStatusBadge("))
  assert.match(ui, /status === "active" \? "success"/)
  assert.match(ui, /status === "paused" \? "warning"/)
  assert.match(ui, /: "danger"/)
  assert.ok(workIntegrations.includes("<IntegrationStatusBadge status={integration?.status}"))
  assert.ok(inboxIntegrations.includes("<IntegrationStatusBadge status={integration?.status}"))
  assert.ok(!workIntegrations.includes("function Badge("))
  assert.ok(!inboxIntegrations.includes("function Badge("))
})

test("Bandeja y Aprobaciones distinguen señales propias de cada área", () => {
  const approvals = readFileSync(new URL("../src/app/w/[workspaceId]/aprobaciones/page.tsx", import.meta.url), "utf8")
  const inboxList = readFileSync(new URL("../src/app/w/[workspaceId]/bandeja/inbox-list.tsx", import.meta.url), "utf8")
  assert.ok(ui.includes("export function InboxSignalBadge("))
  assert.ok(ui.includes('kind: "urgency" | "needs_reply" | "pending_classification"'))
  assert.ok(approvals.includes("<RunStatusBadge status={run.status} />"))
  assert.ok(inboxList.includes('<InboxSignalBadge kind="urgency"'))
  assert.ok(inboxList.includes('<InboxSignalBadge kind="needs_reply" />'))
  assert.ok(inboxList.includes('<InboxSignalBadge kind="pending_classification" />'))
  assert.ok(!inboxList.includes("URGENCY_STYLE"))
})


test("Bandeja, Ejecuciones y panel de automatización usan avisos compartidos", () => {
  for (const source of [replyComposer, runLive, runPanel]) {
    assert.match(source, /import\s*\{[^}]*\bInfoBanner\b[^}]*\}\s*from\s*"@\/components\/ui"/)
    assert.ok(source.includes('<InfoBanner tone="danger" role="alert"'))
    assert.ok(!/border-l-2 border-alert bg-alert-bg/.test(source))
  }
  assert.ok(replyComposer.includes('<InfoBanner tone="success" role="status"'))
})


test("FormMessage reutiliza InfoBanner y conserva los roles accesibles", () => {
  const form = readFileSync(new URL("../src/components/form.tsx", import.meta.url), "utf8")
  assert.ok(form.includes("InfoBanner") && form.includes('from "@/components/ui"'))
  assert.ok(form.includes('<InfoBanner tone="danger" role="alert">'))
  assert.ok(form.includes('<InfoBanner tone="success" role="status">'))
  assert.ok(!form.includes("border-l-2 border-alert bg-alert-bg"))
  assert.ok(!form.includes("border-l-2 border-ok bg-ok-bg"))
})

test("acciones principales reutilizan los botones del sistema de diseño", () => {
  assert.ok(flowEditor.includes('import { PrimaryButton, SecondaryButton } from "@/components/ui"'))
  assert.ok(flowEditor.includes("<PrimaryButton"))
  assert.ok(flowEditor.includes("<SecondaryButton"))
  assert.ok(runLive.includes("<PrimaryButton"))
  assert.ok(runLive.includes("<SecondaryButton"))
  assert.ok(runPanel.includes("<PrimaryButton"))
  assert.ok(runPanel.includes("<SecondaryButton"))
  assert.ok(googleCard.includes("<PrimaryButton"))
  assert.ok(invitePage.includes("<PrimaryButton"))
  for (const source of [flowEditor, runLive, runPanel, googleCard, invitePage]) {
    assert.ok(!/h-11 bg-stroke px-\d+ text-base font-semibold text-stroke-ink/.test(source))
  }
})
