import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { listAttendanceDayPunches } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const personnelId = searchParams.get("personnelId")
  const date = searchParams.get("date")
  if (!branchId || !personnelId || !date) throw new ValidationError("ต้องระบุ branchId, personnelId และ date")
  const data = await listAttendanceDayPunches(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId,
    personnelId,
    date,
  })
  return Response.json({ data })
})
