import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getExpenseReport } from "@/modules/finance"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await getExpenseReport(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    expenseTypeId: searchParams.get("expenseTypeId"),
    processId: searchParams.get("processId"),
    costCenterId: searchParams.get("costCenterId"),
    sourceModule: searchParams.get("sourceModule"),
    vendorId: searchParams.get("vendorId"),
    status: searchParams.get("status"),
  })
  return Response.json(result)
})
