import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getIncomeSummary, incomeReceivedWindow, listIncomes } from "@/modules/finance"
import { IncomeList } from "@/components/finance/income-list"
import { canFinance, getIncomePerms } from "../finance-access"

export const dynamic = "force-dynamic"

export default async function FinanceIncomesPage(props: { searchParams: Promise<{ status?: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "incomes", "read")) redirect("/")

  const { status: requested } = await props.searchParams
  const status = requested === "APPROVED" || requested === "RECEIVED" ? requested : "DRAFT,PENDING,REJECTED"
  const receivedWindow = incomeReceivedWindow()
  const companyId = session.user.companyId as string
  const [list, summary] = await Promise.all([
    listIncomes(prisma, {
      companyId,
      roles,
      status,
      ...(status === "RECEIVED" ? { dateFrom: receivedWindow.from, dateTo: receivedWindow.to } : {}),
    }),
    getIncomeSummary(prisma, {
      companyId,
      roles,
      receivedFrom: receivedWindow.from,
      receivedTo: receivedWindow.to,
    }),
  ])

  return (
    <Suspense fallback={null}>
      <IncomeList perms={getIncomePerms(roles)} initialItems={list.data} initialSummary={summary} />
    </Suspense>
  )
}
