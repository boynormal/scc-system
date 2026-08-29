import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getExpense } from "@/modules/finance"
import { ExpenseFormPage } from "@/components/finance/expense-form-page"
import { canFinance, getFinancePerms } from "../../../finance-access"

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "expenses", "update")) redirect("/finance/expenses")

  const { id } = await params
  if (id === "new" || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/finance/expenses")
  try {
    const { data } = await getExpense(prisma, {
      companyId: session.user.companyId as string,
      roles,
      id,
    })
    return <ExpenseFormPage mode="edit" item={data} perms={getFinancePerms(roles)} />
  } catch {
    redirect("/finance/expenses")
  }
}
