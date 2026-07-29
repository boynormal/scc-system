"use client"

import { GlassTabs } from "@/components/glass"

export type TransportTabDef = { href: string; label: string; exact: boolean }

export function TransportModuleTabs({ tabs }: { tabs: TransportTabDef[] }) {
  if (tabs.length === 0) return null

  return (
    <GlassTabs
      aria-label="ขนส่ง"
      className="mb-0 border-b border-glass bg-glass-strong px-4 backdrop-blur-glass md:px-6"
      items={tabs.map((tab) => ({
        id: tab.href,
        href: tab.href,
        label: tab.label,
        exact: tab.exact,
      }))}
    />
  )
}
