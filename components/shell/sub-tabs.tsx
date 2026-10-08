"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type SubTabItem = {
  key: string
  label: ReactNode
  count?: number
  href?: string
  icon?: ReactNode
  /** Extra badge emphasis (e.g. alert tab). */
  emphasizeCount?: boolean
}

export function SubTabs({
  items,
  activeKey,
  onChange,
  className,
  size = "md",
  "aria-label": ariaLabel = "แท็บรอง",
}: {
  items: SubTabItem[]
  activeKey: string
  onChange?: (key: string) => void
  className?: string
  size?: "sm" | "md"
  "aria-label"?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-white/80 bg-white/40 p-1 shadow-[0_10px_28px_rgb(15_23_42/0.08),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-2xl dark:border-white/20 dark:bg-white/10",
        className
      )}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.key === activeKey
        const itemClass = cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium transition-colors",
          size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-1.5 text-sm",
          active
            ? "bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 text-white shadow-[0_8px_16px_rgb(16_185_129/0.45),inset_0_1px_0_rgb(255_255_255/0.7)] ring-1 ring-white/50 dark:from-emerald-400 dark:via-emerald-500 dark:to-emerald-700 dark:text-white"
            : "text-slate-700/80 hover:bg-white/40 hover:text-slate-900 dark:text-foreground/70 dark:hover:bg-white/10 dark:hover:text-foreground"
        )
        const badge =
          typeof item.count === "number" ? (
            <span
              className={cn(
                "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                item.emphasizeCount && item.count > 0
                  ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : active
                    ? "bg-white/25 text-white"
                    : "bg-white/70 text-slate-800 dark:bg-white/15 dark:text-slate-100"
              )}
            >
              {item.count}
            </span>
          ) : null

        const content = (
          <>
            {item.icon}
            {item.label}
            {badge}
          </>
        )

        if (item.href) {
          return (
            <Link key={item.key} href={item.href} className={itemClass}>
              {content}
            </Link>
          )
        }

        return (
          <button key={item.key} type="button" onClick={() => onChange?.(item.key)} className={itemClass}>
            {content}
          </button>
        )
      })}
    </div>
  )
}
