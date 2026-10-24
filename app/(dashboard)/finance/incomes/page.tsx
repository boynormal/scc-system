import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getIncomeSummary, listIncomes } from "@/modules/finance"
import { IncomeList } from "@/components/finance/income-list"
import { canFinance, getIncomePerms } from "../finance-access"

export const dynamic = "force-dynamic"

export default async function FinanceIncomesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "incomes", "read")) redirect("/")

  const companyId = session.user.companyId as string
  const [list, summary] = await Promise.all([
    listIncomes(prisma, { companyId, roles }),
    getIncomeSummary(prisma, { companyId, roles }),
  ])

  return (
    <Suspense fallback={null}>
      <IncomeList perms={getIncomePerms(roles)} initialItems={list.data} initialSummary={summary} />
    </Suspense>
  )
}
