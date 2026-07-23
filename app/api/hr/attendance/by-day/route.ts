import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { deleteAttendanceByDay, deleteAttendanceByDaySchema } from "@/modules/hr"

export const DELETE = withAuth(async (req, _ctx, session) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    throw new ValidationError("Invalid JSON")
  }
  const parsed = deleteAttendanceByDaySchema.safeParse(json)
  if (!parsed.success) {
    throw new ValidationError("ต้องระบุ branchId และ workDate (YYYY-MM-DD)")
  }

  const result = await deleteAttendanceByDay(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    branchId: parsed.data.branchId,
    workDate: parsed.data.workDate,
  })
  return Response.json({ ok: true, deleted: result.deletedCount })
})
