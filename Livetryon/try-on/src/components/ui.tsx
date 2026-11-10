import type { ReactNode } from "react"

export function Button({
  children,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  variant = "primary",
  disabled,
  className = "",
  title,
  type = "button"
}: {
  children: ReactNode
  onClick?: () => void
  onPointerDown?: () => void
  onPointerUp?: () => void
  onPointerLeave?: () => void
  variant?: "primary" | "ghost" | "danger" | "success"
  disabled?: boolean
  className?: string
  title?: string
  type?: "button" | "submit"
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  const variants: Record<string, string> = {
    primary: "bg-primary text-white hover:bg-[#5b4bd8]",
    ghost: "bg-surface text-ink border border-hairline hover:border-primary/40",
    danger: "bg-ink text-white hover:bg-[#232638]",
    success: "bg-success text-white hover:brightness-105"
  }
  return (
    <button
      type={type}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      disabled={disabled}
      title={title}
      className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function Chip({
  children,
  active,
  tone = "default",
  className = ""
}: {
  children: ReactNode
  active?: boolean
  tone?: "default" | "live" | "warn"
  className?: string
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
  const tones: Record<string, string> = {
    live: "border-success/30 bg-success/10 text-[#1d8f66]",
    warn: "border-warning/30 bg-warning/10 text-[#b47d1b]",
    default: active ? "border-primary/40 bg-primary/10 text-primary" : "border-hairline bg-surface text-muted"
  }
  return <span className={`${base} ${tones[tone]} ${className}`}>{children}</span>
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-hairline bg-surface shadow-panel ${className}`}>
      {children}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline border-t-primary" />
      {label && <span>{label}</span>}
    </div>
  )
}
