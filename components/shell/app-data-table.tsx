import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Frosted card for a list table. The blur lives on a layer behind the content because
 * `backdrop-filter` on an ancestor stops a `position: sticky` header from sticking.
 */
export function AppDataTablePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative min-w-0 rounded-xl border border-slate-300/70 text-foreground shadow-[0_10px_32px_rgb(15_23_42/0.12)] dark:border-white/15 dark:shadow-[0_16px_48px_rgb(0_0_0/0.35)]",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-white/80 backdrop-blur-xl backdrop-saturate-150 dark:bg-slate-900/40"
      />
      <div className="relative">{children}</div>
    </div>
  )
}

export function AppDataTable({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("w-full border-separate border-spacing-0 text-sm", className)}>{children}</table>
}

/**
 * Gray header row, pinned just under the 56px navbar while the page scrolls.
 * Pass `sticky={false}` for a table inside a card, a dialog, or a horizontal scroller,
 * which would become the sticky ancestor.
 */
export function AppDataTableHead({
  children,
  sticky = true,
  dense = false,
}: {
  children: ReactNode
  sticky?: boolean
  /** Narrow `px-2 py-2` header cells; page padding classes on `th` are overridden by the shell. */
  dense?: boolean
}) {
  return (
    <thead
      className={cn(
        "text-left [&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:text-sm [&_th]:font-semibold [&_th]:!text-slate-900 dark:[&_th]:!text-slate-100",
        dense ? "[&_th]:px-2 [&_th]:py-2" : "[&_th]:px-4 [&_th]:py-3",
        "[&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl",
        sticky && "[&_th]:sticky [&_th]:top-14 [&_th]:z-20"
      )}
    >
      {children}
    </thead>
  )
}

/** Rows with `data-tone` keep their own background instead of the shared translucent one. */
export function AppDataTableBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="[&>tr:not([data-tone])]:bg-white/50 [&>tr]:transition-colors [&>tr:hover]:bg-white/80 dark:[&>tr:not([data-tone])]:bg-transparent dark:[&>tr:hover]:bg-white/5 [&>tr>td]:border-b [&>tr>td]:border-border [&:last-child>tr:last-child>td]:border-b-0 [&_td]:text-foreground">
      {children}
    </tbody>
  )
}
