"use client"

import { GlassTabs } from "@/components/glass"

export type HrTabDef = { href: string; label: string }

export function HrModuleTabs({ tabs }: { tabs: HrTabDef[] }) {
  if (tabs.length < 2) return null

  return (
    <GlassTabs
      aria-label="บุคลากรและเวลา"
      className="border-b border-border"
      items={tabs.map((tab) => ({
        id: tab.href,
        href: tab.href,
        label: tab.label,
      }))}
    />
  )
}
