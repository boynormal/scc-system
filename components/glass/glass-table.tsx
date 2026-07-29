import { cn } from "@/lib/utils"
import { GlassSurface } from "./glass-surface"

export function GlassTable({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <GlassSurface intensity="default" className={cn("overflow-hidden rounded-glass", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">{children}</table>
      </div>
    </GlassSurface>
  )
}

export function GlassTableHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <thead
      className={cn(
        "sticky top-0 z-10 border-b border-glass bg-glass-strong backdrop-blur-glass",
        className
      )}
    >
      {children}
    </thead>
  )
}

export function GlassTableBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <tbody className={cn("divide-y divide-border", className)}>{children}</tbody>
}

export function GlassTableRow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <tr
      className={cn(
        "bg-white/40 transition-colors hover:bg-white/70 dark:bg-slate-950/20 dark:hover:bg-slate-950/40",
        className
      )}
    >
      {children}
    </tr>
  )
}

export function GlassTableHead({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  )
}

export function GlassTableCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <td className={cn("px-4 py-3 text-foreground", className)}>{children}</td>
  )
}
