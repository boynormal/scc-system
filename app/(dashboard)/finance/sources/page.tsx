import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import type { UserRole } from "@/lib/permissions"
import { ExpenseSourcesView } from "@/components/finance/expense-sources-view"
import { canFinance, getFinancePerms } from "../finance-access"

export default async function FinanceSourcesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "expenses", "read")) redirect("/")

  return <ExpenseSourcesView perms={getFinancePerms(roles)} />
}
