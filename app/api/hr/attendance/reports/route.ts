import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { listAttendanceReport } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const departmentId = searchParams.get("departmentId")
  if (!branchId || !from || !to) throw new ValidationError("ต้องระบุ branchId, from และ to")
  const data = await listAttendanceReport(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId,
    from,
    to,
    departmentId: departmentId || null,
  })
  return Response.json({ data })
})
