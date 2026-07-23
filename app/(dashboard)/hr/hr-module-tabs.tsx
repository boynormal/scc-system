"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export type HrTabDef = { href: string; label: string }

export function HrModuleTabs({ tabs }: { tabs: HrTabDef[] }) {
  const pathname = usePathname()
  if (tabs.length < 2) return null

  return (
    <div className="-mt-1 mb-6 border-b border-slate-200">
      <nav className="-mb-px flex flex-wrap gap-1" aria-label="บุคลากรและเวลา">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
