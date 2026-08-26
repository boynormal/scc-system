import Link from "next/link"
import type { ReactNode } from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassSurface } from "@/components/glass"
import { DUE_GLASS_PANEL } from "./due-alert-theme"

export function DuePageHeader({
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  actions?: ReactNode
}) {
  return (
    <GlassSurface intensity="soft" className={cn("relative overflow-hidden rounded-[1.5rem] px-6 py-5", DUE_GLASS_PANEL)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-500/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-36 w-36 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-400/10"
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {backHref && backLabel && (
            <Link
              href={backHref}
              className="text-sm text-violet-700/80 hover:text-violet-900 dark:text-violet-300"
            >
              ← {backLabel}
            </Link>
          )}
          <div className={backHref ? "mt-1 flex items-center gap-3" : "flex items-center gap-3"}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600/90 text-white shadow-md shadow-violet-600/25 backdrop-blur-sm">
              <CalendarDays className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </GlassSurface>
  )
}
