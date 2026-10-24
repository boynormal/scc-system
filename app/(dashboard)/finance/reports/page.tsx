import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { ExpenseReportsView } from "@/components/finance/expense-reports-view"
import { IncomeReportsView } from "@/components/finance/income-reports-view"
import { FinanceReportTabs } from "@/components/finance/finance-report-tabs"
import { canFinance } from "../finance-access"

export default async function FinanceReportsPage(props: { searchParams: Promise<{ view?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  const canExpenses = canFinance(roles, "expenses", "read")
  const canIncomes = canFinance(roles, "incomes", "read")
  if (!canExpenses && !canIncomes) redirect("/")

  const { view } = await props.searchParams
  const active = (view === "incomes" && canIncomes) || !canExpenses ? "incomes" : "expenses"
  const tabs =
    canExpenses && canIncomes ? <FinanceReportTabs active={active} /> : null

  if (active === "incomes") return <IncomeReportsView tabs={tabs} />
  return (
    <div className="space-y-4">
      {tabs}
      <ExpenseReportsView />
    </div>
  )
}
