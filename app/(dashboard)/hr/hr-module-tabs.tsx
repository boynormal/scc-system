"use client"

import { NavbarModuleTabs } from "@/components/shell/navbar-module-tabs"

export type HrTabDef = { href: string; label: string }

export function HrModuleTabs({ tabs }: { tabs: HrTabDef[] }) {
  if (tabs.length < 2) return null

  return (
    <NavbarModuleTabs
      aria-label="บุคลากรและเวลา"
      items={tabs.map((tab) => ({
        key: tab.href,
        href: tab.href,
        label: tab.label,
      }))}
    />
  )
}
