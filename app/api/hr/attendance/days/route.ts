import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { listAttendanceDays } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const date = searchParams.get("date")
  if (!branchId || !date) throw new ValidationError("ต้องระบุ branchId และ date")
  const data = await listAttendanceDays(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId,
    date,
  })
  return Response.json({ data })
})
