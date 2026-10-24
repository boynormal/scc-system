"use client"

import { NavbarModuleTabs } from "@/components/shell/navbar-module-tabs"

export type TransportTabDef = { href: string; label: string; exact: boolean }

export function TransportModuleTabs({ tabs }: { tabs: TransportTabDef[] }) {
  if (tabs.length === 0) return null

  return (
    <NavbarModuleTabs
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
