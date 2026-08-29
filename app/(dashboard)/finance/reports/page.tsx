import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { ExpenseReportsView } from "@/components/finance/expense-reports-view"
import { canFinance } from "../finance-access"

export default async function FinanceReportsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "expenses", "read")) redirect("/")

  return <ExpenseReportsView />
}
