import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { FinanceOverview } from "@/components/finance/finance-overview"
import { canFinance } from "./finance-access"

export default async function FinancePage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  const canExpenses = canFinance(roles, "expenses", "read")
  const canIncomes = canFinance(roles, "incomes", "read")
  if (!canExpenses && !canIncomes) redirect("/")

  return <FinanceOverview canExpenses={canExpenses} canIncomes={canIncomes} />
}
