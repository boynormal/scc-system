import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { listAttendanceDayCounts } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const branchId = new URL(req.url).searchParams.get("branchId")
  if (!branchId) throw new ValidationError("ต้องระบุ branchId")
  const data = await listAttendanceDayCounts(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId,
  })
  return Response.json({ data })
})
