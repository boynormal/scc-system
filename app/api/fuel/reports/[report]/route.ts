import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { NotFoundError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import {
  fuelReportQuerySchema,
  getFuelConsumptionReport,
  getFuelMovementReport,
  getFuelStockReport,
  parseOrThrow,
} from "@/modules/fuel"

/** report = stock | movement | consumption */
export const GET = withAuth(async (req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "fuel", "read")
  if (denied) return denied
  const { report } = await ctx.params
  const { searchParams } = new URL(req.url)
  const query = parseOrThrow(fuelReportQuerySchema, {
    branchId: searchParams.get("branchId") || null,
    assetId: searchParams.get("assetId") || null,
    dateFrom: searchParams.get("dateFrom") || null,
    dateTo: searchParams.get("dateTo") || null,
  })
  const companyId = session.user.companyId as string
  switch (report) {
    case "stock":
      return Response.json(await getFuelStockReport(prisma, { companyId, roles, branchId: query.branchId }))
    case "movement":
      return Response.json(await getFuelMovementReport(prisma, { companyId, roles, query }))
    case "consumption":
      return Response.json(await getFuelConsumptionReport(prisma, { companyId, roles, query }))
    default:
      throw new NotFoundError("ไม่พบรายงาน")
  }
})
