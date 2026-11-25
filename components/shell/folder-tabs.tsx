"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type FolderTabItem = {
  key: string
  label: ReactNode
  count?: number | null
  icon?: ReactNode
}

/** Put on the panel right under `FolderTabs` so the tab row sits on its blue top edge. */
export const folderTabsPanelClass = "rounded-tl-none border-t-2 border-t-blue-600 dark:border-t-blue-500"

/**
 * Folder tabs that sit on top of a table or panel: rounded top-left corner, curved
 * slanted right edge, icon + label + count. The active tab is filled blue.
 */
export function FolderTabs({
  items,
  activeKey,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  items: FolderTabItem[]
  activeKey: string
  onChange: (key: string) => void
  "aria-label"?: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex items-end overflow-x-auto pr-6 pt-1", className)}
    >
      {items.map((item, index) => {
        const active = item.key === activeKey
        const fill = active
          ? "border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-600"
          : "border-slate-200 bg-slate-100 group-hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:group-hover:bg-slate-700"
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "group relative inline-flex h-11 shrink-0 items-center gap-2 pl-4 pr-10 text-base font-semibold",
              "rounded-t-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
              index > 0 && "-ml-3",
              active ? "text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            )}
            style={{ zIndex: active ? items.length + 1 : items.length - index }}
          >
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 right-9 rounded-tl-xl border border-b-0 border-r-0 transition-colors", fill)}
            />
            <span
              aria-hidden
              className={cn(
                "absolute bottom-0 right-0 top-0 w-10 origin-bottom-left skew-x-[24deg] rounded-tr-xl border border-b-0 border-l-0 transition-colors",
                fill
              )}
            />
            {item.icon ? (
              <span
                aria-hidden
                className={cn(
                  "relative flex h-5 w-5 items-center justify-center [&>svg]:h-5 [&>svg]:w-5",
                  active ? "text-white" : "text-slate-500 dark:text-slate-400"
                )}
              >
                {item.icon}
              </span>
            ) : null}
            <span className="relative whitespace-nowrap">{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={cn(
                  "relative min-w-7 rounded-full px-2 py-0.5 text-center text-sm font-bold tabular-nums",
                  active
                    ? "bg-white/25 text-white"
                    : "border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                )}
              >
                {item.count ?? "–"}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
