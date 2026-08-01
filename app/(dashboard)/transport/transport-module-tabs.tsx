"use client"

import { GlassTabs } from "@/components/glass"

export type TransportTabDef = { href: string; label: string; exact: boolean }

export function TransportModuleTabs({ tabs }: { tabs: TransportTabDef[] }) {
  if (tabs.length === 0) return null

  return (
    <GlassTabs
      aria-label="ขนส่ง"
      className="mb-4 rounded-2xl border border-white/45 bg-white/35 px-3 py-1 shadow-sm backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/35 md:px-4"
      items={tabs.map((tab) => ({
        id: tab.href,
        href: tab.href,
        label: tab.label,
        exact: tab.exact,
      }))}
    />
  )
}
