import { cn } from "@/lib/utils"
import { AlertTriangle, Check, Clock, Hourglass, X } from "lucide-react"
import type { DueAlertLevel } from "./due-item-types"
import { ALERT_VISUAL } from "./due-alert-theme"

const ICONS: Record<DueAlertLevel, typeof Check> = {
  normal: Check,
  watch: Clock,
  approaching: Hourglass,
  urgent: AlertTriangle,
  expired: X,
}

const ICON_BG: Record<DueAlertLevel, string> = {
  normal: "bg-emerald-500",
  watch: "bg-sky-500",
  approaching: "bg-amber-400",
  urgent: "bg-orange-500",
  expired: "bg-red-500",
}

const SPARK: Record<DueAlertLevel, { d: string; stroke: string }> = {
  normal: { d: "M0 16 C8 14 12 8 18 10 S28 4 40 7", stroke: "#22c55e" },
  watch: { d: "M0 12 C8 18 14 8 20 14 S30 6 40 12", stroke: "#0ea5e9" },
  approaching: { d: "M0 14 C10 8 16 18 22 12 S32 16 40 10", stroke: "#f59e0b" },
  urgent: { d: "M0 10 C8 16 14 6 22 14 S30 8 40 16", stroke: "#f97316" },
  expired: { d: "M0 14 C8 8 14 18 22 10 S30 16 40 12", stroke: "#ef4444" },
}

export function DueAlertStatCard({
  level,
  label,
  value,
  hint,
  selected,
}: {
  level: DueAlertLevel
  label: string
  value: string
  hint: string
  selected?: boolean
}) {
  const visual = ALERT_VISUAL[level]
  const Icon = ICONS[level]
  const spark = SPARK[level]
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-[0_8px_28px_rgb(15_23_42/0.06)] backdrop-saturate-150 transition-shadow",
        visual.surface,
        selected && `ring-2 ring-offset-2 ring-offset-transparent ${visual.ring}`
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-white", ICON_BG[level])}>
          <Icon className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <span className={cn("text-sm font-semibold", visual.text)}>{label}</span>
      </div>
      <p className={cn("mt-3 text-4xl font-bold tabular-nums tracking-tight", visual.text)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <svg
        viewBox="0 0 40 22"
        className="pointer-events-none absolute bottom-2 right-2 h-8 w-16 opacity-80"
        aria-hidden
      >
        <path d={spark.d} fill="none" stroke={spark.stroke} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}
