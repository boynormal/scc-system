import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { APPEARANCE_COOKIE, resolveAppearance } from "@/shared/appearance"
import { canEnterModuleArea } from "@/shared/permissions/module-access-catalog"
import { ModuleBackdrop } from "@/components/shell/module-backdrop"
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
    canExpenses && { href: "/finance/sources", label: "ต้นทางโมดูล", exact: false },
    canExpenses && { href: "/finance/reports", label: "รายงาน", exact: false },
    canMasters && { href: "/finance/master-data", label: "ข้อมูลพื้นฐาน", exact: false },
  ].filter(Boolean) as { href: string; label: string; exact: boolean }[]

  const cookieStore = await cookies()
  const isDark = resolveAppearance(cookieStore.get(APPEARANCE_COOKIE)?.value) === "dark"

  return (
    <ModuleBackdrop isDark={isDark}>
      <div className="space-y-6">
        <FinanceModuleTabs tabs={tabs} />
        <div className="min-w-0">{children}</div>
      </div>
    </ModuleBackdrop>
  )
}
