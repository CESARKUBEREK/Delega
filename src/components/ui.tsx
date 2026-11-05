"use client"

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="ms-page-header">
      <div className="ms-page-header-copy">
        {eyebrow ? <p className="ms-page-header-eyebrow">{eyebrow}</p> : null}
        <h1 className="ms-page-header-title">{title}</h1>
        {description ? <p className="ms-panel-card-description">{description}</p> : null}
      </div>
      {actions ? <div className="ms-page-header-actions">{actions}</div> : null}
    </header>
  )
}

export function PanelCard({
  title,
  description,
  actions,
  children,
  className = "",
  bodyPadding = "default",
  headerDensity = "default",
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyPadding?: "default" | "none"
  headerDensity?: "default" | "compact"
}) {
  return (
    <section className={`ms-panel-card ${className}`.trim()}>
      {title || description || actions ? (
        <header className="ms-panel-card-header" data-density={headerDensity}>
          <div>
            {title ? <h2 className="ms-panel-card-title">{title}</h2> : null}
            {description ? <p className="ms-page-header-description">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="ms-panel-card-body" data-padding={bodyPadding}>{children}</div>
    </section>
  )
}

export function PrimaryButton({ className = "", ...props }: ButtonProps) {
  return <button className={`ms-button ms-button-primary ${className}`.trim()} {...props} />
}

export function SecondaryButton({ className = "", ...props }: ButtonProps) {
  return <button className={`ms-button ms-button-secondary ${className}`.trim()} {...props} />
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "success" | "warning" | "danger" | "info" | "neutral"
}) {
  return <span className="ms-status-badge" data-tone={tone}>{children}</span>
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="ms-empty-state">
      {icon ? <span className="ms-empty-state-icon" aria-hidden="true">{icon}</span> : null}
      <div>
        <h2 className="ms-empty-state-title">{title}</h2>
        {description ? <p className="ms-empty-state-description">{description}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </section>
  )
}

export function InfoBanner({
  children,
  tone = "info",
  role,
  className,
}: {
  children: ReactNode
  tone?: "info" | "success" | "warning" | "danger"
  role?: "status" | "alert"
  className?: string
}) {
  return <div className={`ms-info-banner ${className ?? ""}`.trim()} data-tone={tone} role={role ?? (tone === "danger" ? "alert" : "status")}>{children}</div>
}

export function SearchInput({
  label,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className={`ms-search-input ${className}`.trim()}>
      <span className="sr-only">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
      <input type="search" aria-label={label} {...props} />
    </label>
  )
}
