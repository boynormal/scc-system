import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getIncome } from "@/modules/finance"
import { IncomeFormPage } from "@/components/finance/income-form-page"
import { canFinance } from "../../../finance-access"

export const dynamic = "force-dynamic"

export default async function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "incomes", "update")) redirect("/finance/incomes")

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/finance/incomes")
  const data = await getIncome(prisma, { companyId: session.user.companyId as string, roles, id })
    .then((r) => r.data)
    .catch(() => null)
  if (!data) redirect("/finance/incomes")
  if (data.status === "APPROVED" || data.status === "CANCELLED") redirect(`/finance/incomes/${id}`)
  return <IncomeFormPage item={data} />
}
