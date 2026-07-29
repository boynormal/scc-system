import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

interface GlassChartCardProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function GlassChartCard({
  title,
  description,
  actions,
  children,
  className,
}: GlassChartCardProps) {
  return (
    <GlassSurface
      intensity="default"
      className={cn("rounded-glass text-foreground", className)}
    >
      <div className="flex items-start justify-between gap-3 border-b border-glass px-5 py-4">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </GlassSurface>
  )
}
