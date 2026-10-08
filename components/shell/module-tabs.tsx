"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type ModuleTabItem = {
  key: string
  label: string
  href?: string
  /** Match only the path itself. Needed for a module root such as /finance. */
  exact?: boolean
}

function isHrefActive(pathname: string, href: string, exact?: boolean) {
  const path = href.split("?")[0] || href
  if (exact) return pathname === path
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function ModuleTabs({
  items,
  activeKey,
  onChange,
  className,
  "aria-label": ariaLabel = "แท็บหลัก",
}: {
  items: ModuleTabItem[]
  activeKey?: string
  onChange?: (key: string) => void
  className?: string
  "aria-label"?: string
}) {
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-white/80 bg-white/40 p-1 shadow-[0_10px_28px_rgb(15_23_42/0.08),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-2xl dark:border-white/20 dark:bg-white/10",
        className
      )}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active =
          activeKey != null
            ? activeKey === item.key
            : item.href
              ? isHrefActive(pathname, item.href, item.exact)
              : false
        const itemClass = cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600 text-white shadow-[0_8px_16px_rgb(244_63_94/0.45),inset_0_1px_0_rgb(255_255_255/0.7)] ring-1 ring-white/50 dark:from-rose-400 dark:via-rose-500 dark:to-rose-700 dark:text-white"
            : "text-slate-700/80 hover:bg-white/40 hover:text-slate-900 dark:text-foreground/70 dark:hover:bg-white/10 dark:hover:text-foreground"
        )

        if (onChange) {
          return (
            <button key={item.key} type="button" onClick={() => onChange(item.key)} className={itemClass}>
              {item.label}
            </button>
          )
        }

        if (!item.href) return null

        return (
          <Link key={item.key} href={item.href} className={itemClass}>
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
