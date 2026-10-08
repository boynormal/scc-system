import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Default frame for a module page sitting inside the dashboard main padding. */
export const modulePageClassName = "-m-6 min-h-[calc(100vh-3.5rem)] overflow-hidden p-6"

export function ModuleBackdrop({
  isDark,
  className = modulePageClassName,
  children,
}: {
  isDark: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        isDark
          ? "dark from-[#050816] via-[#111b45] to-[#34235d] text-slate-100"
          : "from-[#dff4ff] via-[#e8e7ff] to-[#fce7f3] text-slate-900",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(14,165,233,0.24),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(244,114,182,0.22),transparent_28%),radial-gradient(circle_at_52%_92%,rgba(139,92,246,0.20),transparent_35%)] dark:bg-[radial-gradient(circle_at_14%_12%,rgba(59,130,246,0.28),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(192,132,252,0.22),transparent_30%),radial-gradient(circle_at_52%_92%,rgba(236,72,153,0.14),transparent_35%)]" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-[26rem] w-[26rem] rounded-full bg-cyan-300/20 blur-3xl dark:bg-blue-500/15" />
      <div className="pointer-events-none absolute -right-24 top-4 h-[28rem] w-[28rem] rounded-full bg-rose-300/20 blur-3xl dark:bg-violet-500/15" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/3 h-[26rem] w-[26rem] rounded-full bg-violet-300/15 blur-3xl dark:bg-fuchsia-500/10" />
      {children}
    </div>
  )
}
