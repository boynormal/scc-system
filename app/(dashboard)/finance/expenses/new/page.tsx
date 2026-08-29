import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { ExpenseFormPage } from "@/components/finance/expense-form-page"
import { canFinance, getFinancePerms } from "../../finance-access"

export default async function NewExpensePage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "expenses", "create")) redirect("/finance/expenses")

  return <ExpenseFormPage mode="create" perms={getFinancePerms(roles)} />
}
