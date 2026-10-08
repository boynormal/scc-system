import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { surfacePanelClass, surfaceTableHeadClass, surfaceTableRowClass } from "@/components/shell/surface"

function scope(variant: string, classes: string) {
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => `${variant}${token}`)
    .join(" ")
}

/** Table and figure shell using the expense-list surface. */
export const dataPanelClassName = cn(
  "overflow-hidden rounded-xl text-foreground",
  surfacePanelClass,
  scope("[&_thead]:", surfaceTableHeadClass),
  scope("[&_tbody_tr]:", surfaceTableRowClass)
)

const paddingMap = { none: "", sm: "p-4", md: "p-5", lg: "p-6" }

export function DataPanel({
  children,
  className,
  padding = "none",
}: {
  children: ReactNode
  className?: string
  padding?: keyof typeof paddingMap
}) {
  return <div className={cn(dataPanelClassName, paddingMap[padding], className)}>{children}</div>
}
