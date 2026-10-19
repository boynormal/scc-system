import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** One-row page title for new screens. Both lines stay `text-foreground` because the header sits on the module gradient. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-2", className)}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
