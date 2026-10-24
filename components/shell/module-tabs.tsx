"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { followTabHref, useNavPending } from "./nav-pending"
import { isPlainLeftClick } from "./nav-pending-utils"
import { SLIDING_PILL_BASE, SLIDING_PILL_MOTION, useSlidingPill } from "./use-sliding-pill"

export type ModuleTabItem = {
  key: string
  label: string
  href?: string
  /** Match only the path itself. Needed for a module root such as /finance. */
  exact?: boolean
}

const ACTIVE_FILL =
  "bg-gradient-to-b from-rose-400 via-rose-500 to-rose-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] dark:from-rose-400 dark:via-rose-500 dark:to-rose-700"

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
  const nav = useNavPending()
  const resolvedKey =
    activeKey ?? items.find((item) => item.href && isHrefActive(pathname, item.href, item.exact))?.key
  const { rootRef, setItemRef, shownKey, select, pillStyle, ready } = useSlidingPill(true, resolvedKey)

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative inline-flex max-w-full flex-wrap items-center gap-1 overflow-hidden rounded-full border border-white/80 bg-white/40 p-1 shadow-[0_10px_28px_rgb(15_23_42/0.08),inset_0_1px_0_rgb(255_255_255/0.9)] backdrop-blur-2xl dark:border-white/20 dark:bg-white/10",
        className
      )}
      aria-label={ariaLabel}
    >
      {pillStyle && (
        <span aria-hidden className={cn(SLIDING_PILL_BASE, "rounded-full", ACTIVE_FILL, ready && SLIDING_PILL_MOTION)} style={pillStyle} />
      )}
      {items.map((item) => {
        const active = item.key === shownKey
        const itemClass = cn(
          "relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300",
          active
            ? "text-white dark:text-white"
            : "text-slate-700/80 hover:bg-white/40 hover:text-slate-900 dark:text-foreground/70 dark:hover:bg-white/10 dark:hover:text-foreground"
        )

        if (onChange) {
          return (
            <button
              key={item.key}
              ref={setItemRef(item.key)}
              type="button"
              aria-pressed={active}
              onClick={() => {
                select(item.key)
                onChange(item.key)
              }}
              className={itemClass}
            >
              {item.label}
            </button>
          )
        }

        if (!item.href) return null

        return (
          <Link
            key={item.key}
            ref={setItemRef(item.key)}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              if (!item.href) return
              if (!nav) {
                if (isPlainLeftClick(event)) select(item.key)
                return
              }
              followTabHref(event, {
                href: item.href,
                scope: "module",
                nav,
                select: () => select(item.key),
              })
            }}
            className={itemClass}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
