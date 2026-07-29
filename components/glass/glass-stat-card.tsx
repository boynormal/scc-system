import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { GlassSurface } from "./glass-surface"

export type GlassStatTrend = {
  value: string
  direction?: "up" | "down" | "neutral"
}

interface GlassStatCardProps {
  label: string
  value: React.ReactNode
  hint?: string
  icon?: LucideIcon
  trend?: GlassStatTrend
  className?: string
}

const trendStyles = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
}

export function GlassStatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: GlassStatCardProps) {
  return (
    <GlassSurface
      intensity="default"
      className={cn("rounded-glass p-5 text-foreground", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-2xl font-bold tracking-tight">{value}</p>
          {(hint || trend) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {trend && (
                <span className={cn("font-medium", trendStyles[trend.direction ?? "neutral"])}>
                  {trend.value}
                </span>
              )}
              {hint && <span className="text-muted-foreground">{hint}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-glass bg-glass-soft text-muted-foreground">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </GlassSurface>
  )
}
