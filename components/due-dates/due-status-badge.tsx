import { cn } from "@/lib/utils"
import type { DueAlertLevel } from "./due-item-types"
import { ALERT_VISUAL, dueTone } from "./due-alert-theme"

export function DueStatusBadge({
  label,
  tone,
}: {
  label: string
  tone: DueAlertLevel | string
}) {
  const visual = ALERT_VISUAL[tone as keyof typeof ALERT_VISUAL] ?? ALERT_VISUAL.normal
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        visual.chip
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", visual.dot)} />
      {label}
    </span>
  )
}

export function DueDaysChip({
  days,
  tone,
}: {
  days: number
  tone: DueAlertLevel | string
}) {
  const visual = ALERT_VISUAL[tone as keyof typeof ALERT_VISUAL] ?? ALERT_VISUAL.normal
  return (
    <span
      className={cn(
        "inline-flex min-w-[3.25rem] justify-center rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums",
        visual.chip
      )}
    >
      {days}
    </span>
  )
}

export { dueTone }
