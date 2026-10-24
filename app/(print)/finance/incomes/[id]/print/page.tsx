import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import type { UserRole } from "@/lib/permissions"
import { getIncome } from "@/modules/finance"
import { IncomePrintView } from "@/components/finance/income-print-view"
import { canFinance } from "@/app/(dashboard)/finance/finance-access"

export const dynamic = "force-dynamic"
export const metadata = { title: "พิมพ์ใบรับเงิน" }

export default async function IncomePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canFinance(roles, "incomes", "read")) redirect("/")

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const sp = await searchParams
  const companyId = session.user.companyId as string

  const [income, company] = await Promise.all([
    getIncome(prisma, { companyId, roles, id })
      .then((r) => r.data)
      .catch(() => null),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, logoUrl: true } }),
  ])
  if (!income) notFound()

  return (
    <IncomePrintView
      income={income}
      companyName={company?.name ?? ""}
      logoUrl={company?.logoUrl ?? null}
      size={sp.size === "80mm" ? "80mm" : "a4"}
      autoPrint={sp.auto === "1"}
    />
  )
}
