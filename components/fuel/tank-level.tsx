import { cn } from "@/lib/utils"

/** Horizontal fill bar; turns amber below the alert level. */
export function TankLevel({ percent, low, className }: { percent: number; low: boolean; className?: string }) {
  const width = Math.max(0, Math.min(100, percent))
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
    >
      <div className={cn("h-full rounded-full", low ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${width}%` }} />
    </div>
  )
}
