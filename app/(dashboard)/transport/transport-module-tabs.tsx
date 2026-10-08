"use client"

import { ModuleTabs } from "@/components/shell/module-tabs"

export type TransportTabDef = { href: string; label: string; exact: boolean }

export function TransportModuleTabs({ tabs }: { tabs: TransportTabDef[] }) {
  if (tabs.length === 0) return null

  return (
    <ModuleTabs
      aria-label="ขนส่ง"
      items={tabs.map((tab) => ({
        key: tab.href,
        href: tab.href,
        label: tab.label,
        exact: tab.exact,
      }))}
    />
  )
}
