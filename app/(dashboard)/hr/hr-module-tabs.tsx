"use client"

import { ModuleTabs } from "@/components/shell/module-tabs"

export type HrTabDef = { href: string; label: string }

export function HrModuleTabs({ tabs }: { tabs: HrTabDef[] }) {
  if (tabs.length < 2) return null

  return (
    <ModuleTabs
      aria-label="บุคลากรและเวลา"
      items={tabs.map((tab) => ({
        key: tab.href,
        href: tab.href,
        label: tab.label,
      }))}
    />
  )
}
