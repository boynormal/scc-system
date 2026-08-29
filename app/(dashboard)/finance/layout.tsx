import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
import { canFinance } from "./finance-access"
import { FinanceModuleTabs } from "./finance-module-tabs"

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  const roles = session.user.roles as UserRole[]
  if (!canEnterModuleArea(roles, "finance", session.user.moduleAccess)) redirect("/")

  const canExpenses = canFinance(roles, "expenses", "read")
  const canMasters = canFinance(roles, "expense_masters", "read")

  const tabs = [
    canExpenses && { href: "/finance", label: "ภาพรวม", exact: true },
    canExpenses && { href: "/finance/expenses", label: "ค่าใช้จ่าย", exact: false },
    canExpenses && { href: "/finance/sources", label: "ผูกจากต้นทาง", exact: false },
    canExpenses && { href: "/finance/reports", label: "รายงาน", exact: false },
    canMasters && { href: "/finance/master-data", label: "ข้อมูลพื้นฐาน", exact: false },
  ].filter(Boolean) as { href: string; label: string; exact: boolean }[]

  return (
    <div className="flex min-w-0 flex-col">
      <div className="shrink-0">
        <FinanceModuleTabs tabs={tabs} />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
