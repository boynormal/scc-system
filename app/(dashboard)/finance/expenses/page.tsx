import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getExpenseSummary, listExpenses } from "@/modules/finance"
import { ExpenseListView } from "@/components/finance/expense-list-view"
import { canFinance, getFinancePerms } from "../finance-access"

export const dynamic = "force-dynamic"

export default async function FinanceExpensesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "expenses", "read")) redirect("/")

  const companyId = session.user.companyId as string
  const [list, summary] = await Promise.all([
    listExpenses(prisma, { companyId, roles }),
    getExpenseSummary(prisma, { companyId, roles }),
  ])

  return (
    <ExpenseListView
      perms={getFinancePerms(roles)}
      initialItems={list.data}
      initialSummary={summary}
    />
  )
}
