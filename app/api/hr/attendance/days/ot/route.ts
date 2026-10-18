import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { decideAttendanceOt, decideAttendanceOtSchema } from "@/modules/hr"

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}))
  const parsed = decideAttendanceOtSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("ข้อมูลยืนยัน OT ไม่ถูกต้อง")
  const data = await decideAttendanceOt(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    ...parsed.data,
  })
  return Response.json({ data })
})
