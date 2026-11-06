"use client"

import { useState } from "react"
import { supervisedPreview } from "@/lib/onboarding"
import type { FlowPlan } from "@/lib/plan"

// Información de confianza mostrada junto al plan: qué hará MarchaSolo y qué
// acciones requieren aprobación explícita.
export function SupervisedNote({ plan }: { plan: FlowPlan }) {
  const preview = supervisedPreview(plan)
  return (
    <div className="rounded-2xl border border-stroke bg-paper p-5 flex flex-col gap-3">
      <p className="font-medium text-ink">Tú apruebas cada acción</p>
      <blockquote className="border-l-2 border-stroke pl-4 text-sm text-graphite">
        <p>«{preview.will}</p>
        <p className="mt-1">
          <strong>{preview.wont}</strong>»
        </p>
      </blockquote>
      {preview.approvals.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-ink">Esperarán tu aprobación</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-graphite">
            {preview.approvals.map((approval) => (
              <li key={approval.id}>{approval.title}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-graphite">Este plan no escribe ni envía nada: solo tendrás que revisar el resultado.</p>
      )}
    </div>
  )
}

// Demostración aislada: enseña el recorrido de una aprobación sin crear
// ejecuciones ni llamar a proveedores externos.
export function DemoApprovalCard({ plan }: { plan: FlowPlan }) {
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">("pending")
  const approval = plan.steps.find((step) => step.requires_approval)

  const statusLabel = decision === "approved"
    ? "APROBADO · SIMULACIÓN"
    : decision === "rejected"
      ? "RECHAZADO · SIMULACIÓN"
      : "PENDIENTE"

  return (
    <section className="rounded-2xl border border-rule bg-sheet p-5 flex flex-col gap-4" aria-labelledby="demo-approval-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-graphite">EJEMPLO INTERACTIVO</p>
          <h3 id="demo-approval-title" className="mt-1 font-semibold text-ink">Así funciona una aprobación</h3>
        </div>
        <span className="rounded-full border border-rule px-2.5 py-1 text-xs font-semibold text-graphite" data-decision={decision}>{statusLabel}</span>
      </div>

      <div className="rounded-xl border border-rule bg-paper p-4 flex flex-col gap-3">
        <div>
          <p className="text-xs text-graphite">ACCIÓN QUE REVISARÍAS</p>
          <p className="mt-1 font-medium text-ink">{approval?.title ?? "Una propuesta de MarchaSolo"}</p>
        </div>
        <div className="border-t border-rule pt-3">
          <p className="text-xs text-graphite">VISTA PREVIA FICTICIA</p>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            MarchaSolo te mostrará aquí el contenido y los cambios concretos de «{plan.name}» antes de hacer nada.
          </p>
        </div>
      </div>

      <p className="text-xs text-graphite">
        Este ejemplo no utiliza tus aplicaciones ni envía, escribe o modifica datos.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {decision === "pending" ? (
          <>
            <button
              type="button"
              onClick={() => setDecision("approved")}
              className="inline-flex h-10 items-center rounded-xl bg-ink px-4 text-sm font-semibold text-paper"
            >
              Simular aprobación
            </button>
            <button
              type="button"
              onClick={() => setDecision("rejected")}
              className="inline-flex h-10 items-center rounded-xl border border-rule px-4 text-sm font-medium text-ink"
            >
              Simular rechazo
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setDecision("pending")}
            className="inline-flex h-10 items-center rounded-xl border border-rule px-4 text-sm font-medium text-ink"
          >
            Repetir ejemplo
          </button>
        )}
      </div>

      <div className="rounded-xl border border-rule bg-paper p-4" role="status" aria-live="polite" data-decision={decision}>
        <p className="text-sm font-semibold text-ink">
          {decision === "approved"
            ? "Has aprobado la propuesta."
            : decision === "rejected"
              ? "Has rechazado la propuesta."
              : "La propuesta espera tu decisión."}
        </p>
        <p className="mt-1 text-sm text-graphite">
          {decision === "approved"
            ? "En una automatización real, MarchaSolo continuaría con esta acción después de tu aprobación."
            : decision === "rejected"
              ? "En una automatización real, esta acción quedaría detenida y no se aplicaría ningún cambio."
              : "Pulsa uno de los botones para ver cómo cambia el resultado."}
          {" "}Esto es solo una simulación: no se ha ejecutado ninguna acción externa.
        </p>
      </div>
    </section>
  )
}
