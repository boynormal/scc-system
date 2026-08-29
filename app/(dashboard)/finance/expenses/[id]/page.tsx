import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getExpense } from "@/modules/finance"
import { ExpenseDetailView } from "@/components/finance/expense-detail-view"
import { canFinance, getFinancePerms } from "../../finance-access"

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "expenses", "read")) redirect("/")

  const { id } = await params
  if (id === "new" || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/finance/expenses")
  try {
    const { data } = await getExpense(prisma, {
      companyId: session.user.companyId as string,
      roles,
      id,
    })
    return <ExpenseDetailView expense={data} perms={getFinancePerms(roles)} />
  } catch {
    redirect("/finance/expenses")
  }
}
