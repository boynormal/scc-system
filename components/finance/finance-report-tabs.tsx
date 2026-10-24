"use client"

import { SubTabs } from "@/components/shell/sub-tabs"

export function FinanceReportTabs({ active }: { active: "expenses" | "incomes" }) {
  return (
    <SubTabs
      size="sm"
      aria-label="ประเภทรายงาน"
      activeKey={active}
      items={[
        { key: "expenses", label: "ค่าใช้จ่าย", href: "/finance/reports" },
        { key: "incomes", label: "รายรับ", href: "/finance/reports?view=incomes" },
      ]}
    />
  )
}
