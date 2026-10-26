import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getIncomeReport } from "@/modules/finance"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await getIncomeReport(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    incomeTypeId: searchParams.get("incomeTypeId"),
    costCenterId: searchParams.get("costCenterId"),
    status: searchParams.get("status"),
  })
  return Response.json(result)
})
