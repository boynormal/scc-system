"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type TransportSegmentedTabItem = {
  key: string
  label: ReactNode
  count?: number
  href?: string
  icon?: ReactNode
  /** Extra badge emphasis (e.g. alert tab). */
  emphasizeCount?: boolean
}

type Props = {
  items: TransportSegmentedTabItem[]
  activeKey: string
  onChange?: (key: string) => void
  className?: string
  size?: "sm" | "md"
}

export function TransportSegmentedTabs({
  items,
  activeKey,
  onChange,
  className,
  size = "md",
}: Props) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100/90 p-1 dark:border-border dark:bg-muted",
        className
      )}
    >
      {items.map((item) => {
        const active = item.key === activeKey
        const itemClass = cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-md font-medium transition-colors",
          size === "sm" ? "px-3 py-1.5 text-xs" : "px-3 py-1.5 text-sm",
          active
            ? "bg-white text-slate-900 shadow-sm dark:bg-background dark:text-foreground"
            : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-background/60 dark:hover:text-foreground"
        )
        const badge =
          typeof item.count === "number" ? (
            <span
              className={cn(
                "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                active
                  ? item.emphasizeCount && item.count > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                    : "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200"
                  : item.emphasizeCount && item.count > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                    : "bg-slate-200/80 text-slate-600 dark:bg-muted-foreground/20 dark:text-muted-foreground"
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
          <button
            key={item.key}
            type="button"
            onClick={() => onChange?.(item.key)}
            className={itemClass}
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}
