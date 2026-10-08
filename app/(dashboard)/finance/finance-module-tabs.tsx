"use client"

import { ModuleTabs } from "@/components/shell/module-tabs"

export type FinanceTabDef = { href: string; label: string; exact: boolean }

export function FinanceModuleTabs({ tabs }: { tabs: FinanceTabDef[] }) {
  if (tabs.length === 0) return null

  return (
    <ModuleTabs
      aria-label="การเงินและบัญชี"
      items={tabs.map((tab) => ({
        key: tab.href,
        href: tab.href,
        label: tab.label,
        exact: tab.exact,
      }))}
    />
  )
}
