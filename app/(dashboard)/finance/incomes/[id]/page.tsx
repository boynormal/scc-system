import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getIncome } from "@/modules/finance"
import { IncomeDetailView } from "@/components/finance/income-detail-view"
import { canFinance, getIncomePerms } from "../../finance-access"

export const dynamic = "force-dynamic"

export default async function IncomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "incomes", "read")) redirect("/")

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/finance/incomes")
  const data = await getIncome(prisma, { companyId: session.user.companyId as string, roles, id })
    .then((r) => r.data)
    .catch(() => null)
  if (!data) redirect("/finance/incomes")
  return <IncomeDetailView income={data} perms={getIncomePerms(roles)} />
}
