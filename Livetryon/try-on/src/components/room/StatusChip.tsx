import { Chip } from "../ui"

const DOT: Record<string, string> = {
  Connecting: "bg-primary animate-pulse",
  Live: "bg-success",
  Reconnecting: "bg-warning animate-pulse",
  Busy: "bg-warning animate-pulse",
  Error: "bg-[#E5484D]"
}

export default function StatusChip({
  label,
  tone = "default"
}: {
  label: string
  tone?: "default" | "live" | "warn"
}) {
  const dot = DOT[label] ?? "bg-muted"
  return (
    <Chip tone={tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </Chip>
  )
}
