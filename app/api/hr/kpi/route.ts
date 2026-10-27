import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { getHrKpi } from "@/modules/hr/application/hr-kpi-service"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month")
  if (!month) throw new ValidationError("ต้องระบุเดือน")
  const data = await getHrKpi(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    month,
    branchId: searchParams.get("branchId"),
    jobGroupId: searchParams.get("jobGroupId"),
  })
  return Response.json({ data })
})
