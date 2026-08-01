"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export type GlassTabItem = {
  id: string
  label: string
  href?: string
  icon?: LucideIcon
  exact?: boolean
}

type ControlledTabsProps = {
  items: GlassTabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
  "aria-label"?: string
}

type LinkTabsProps = {
  items: GlassTabItem[]
  value?: never
  onChange?: never
  className?: string
  "aria-label"?: string
}

export type GlassTabsProps = ControlledTabsProps | LinkTabsProps

export function GlassTabs(props: GlassTabsProps) {
  const pathname = usePathname()
  const { items, className } = props
  const ariaLabel = props["aria-label"] ?? "Tabs"
  const isControlled = "value" in props && props.value !== undefined && !!props.onChange

  return (
    <div className={cn("-mt-1 mb-6", className)}>
      <nav className="-mb-px flex flex-wrap gap-1" aria-label={ariaLabel}>
        {items.map((tab) => {
          const Icon = tab.icon
          let active = false

          if (isControlled) {
            active = props.value === tab.id
          } else if (tab.href) {
            active = tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          }

          const classNameTab = cn(
            "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
            active
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-300"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          )

          if (isControlled) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => props.onChange(tab.id)}
                className={classNameTab}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {tab.label}
              </button>
            )
          }

          if (!tab.href) return null

          return (
            <Link key={tab.id} href={tab.href} className={classNameTab}>
              {Icon && <Icon className="h-4 w-4" />}
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
