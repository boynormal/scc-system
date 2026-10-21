import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { DataPanel } from "@/components/shell/data-panel"
import { PendingFade } from "@/components/shell/nav-pending"
import { PageHeader } from "@/components/shell/page-header"

/** Compact list shell: one header row, one filter row, then the table panel. */
export function ListFrame({
  title,
  description,
  actions,
  filters,
  filterOverflow = false,
  children,
  className,
}: {
  title?: string
  description?: string
  actions?: ReactNode
  filters?: ReactNode
  /** Let a filter popover draw outside the panel, such as the shared day picker. */
  filterOverflow?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0 space-y-4", className)}>
      {title || description || actions ? (
        <PageHeader title={title ?? ""} description={description} actions={actions} />
      ) : null}
      {filters ? (
        <DataPanel padding="sm" className={filterOverflow ? "relative z-20 overflow-visible" : undefined}>
          <div className={cn("flex items-end gap-2 text-foreground", filterOverflow ? "overflow-visible" : "overflow-x-auto")}>
            {filters}
          </div>
        </DataPanel>
      ) : null}
      <PendingFade scope="section">
        <DataPanel padding="none" className="[&_td]:text-foreground [&_th]:text-foreground">
          {children}
        </DataPanel>
      </PendingFade>
    </div>
  )
}
