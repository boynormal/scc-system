import type { ReactNode } from "react"
import { Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassSurface } from "@/components/glass"
import { FIN_GLASS_PANEL } from "./finance-theme"

export function FinancePageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <GlassSurface
      intensity="soft"
      className={cn("relative overflow-hidden rounded-[1.5rem] px-6 py-5", FIN_GLASS_PANEL)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-500/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-36 w-36 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-400/10"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/90 text-white shadow-md shadow-emerald-600/25 backdrop-blur-sm">
            <Wallet className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </GlassSurface>
  )
}

export function ExpenseStatusBadge({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  )
}
