import { cn } from "@/lib/utils"

/** Shared filter-button styles — clearer on light theme, consistent across transport pages. */
export function transportFilterTriggerClass(open: boolean, className?: string) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
    open
      ? "border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-border dark:bg-background dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground",
    className
  )
}
