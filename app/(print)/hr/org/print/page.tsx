import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/shared/db"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { getPersonnelOrgChart } from "@/modules/hr"
import { OrgChartPrintView } from "./org-chart-print-view"

export const metadata = { title: "พิมพ์ผังองค์กร" }

function canRead(roles: UserRole[]) {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "hr_personnel", "read"))
  )
}

function parseIsActive(raw: string | undefined): boolean | null {
  if (raw === "false") return false
  if (raw === "all") return null
  return true
}

export default async function HrOrgPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const roles = session.user.roles as UserRole[]
  if (!canRead(roles)) redirect("/")

  const sp = await searchParams
  if (!sp.branchId) notFound()

  try {
    const [{ data: chart }, company] = await Promise.all([
      getPersonnelOrgChart(prisma, {
        companyId: session.user.companyId as string,
        roles,
        branchId: sp.branchId,
        isActive: parseIsActive(sp.isActive),
      }),
      prisma.company.findUnique({
        where: { id: session.user.companyId as string },
        select: { name: true },
      }),
    ])

    return (
      <OrgChartPrintView
        chart={chart}
        companyName={company?.name ?? ""}
        autoPrint={sp.auto === "1"}
      />
    )
  } catch {
    notFound()
  }
}
