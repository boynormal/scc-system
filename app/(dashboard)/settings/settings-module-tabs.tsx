"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Building2, Database, LayoutDashboard, LayoutGrid, ShieldCheck, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type SettingsTabIcon = "overview" | "users" | "branches" | "roles" | "master-data" | "home-screen"

const TAB_ICON_MAP: Record<SettingsTabIcon, LucideIcon> = {
  overview: LayoutDashboard,
  users: Users,
  branches: Building2,
  roles: ShieldCheck,
  "master-data": Database,
  "home-screen": LayoutGrid,
}

export type SettingsTabDef = { href: string; label: string; icon: SettingsTabIcon; exact?: boolean }

export function SettingsModuleTabs({ tabs }: { tabs: SettingsTabDef[] }) {
  const pathname = usePathname()
  if (tabs.length < 2) return null

  return (
    <div className="-mt-1 mb-6 border-b border-slate-200 dark:border-slate-700">
      <nav className="-mb-px flex flex-wrap gap-1" aria-label="ตั้งค่า">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          const Icon = TAB_ICON_MAP[tab.icon]
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
