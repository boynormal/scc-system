import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { saveAttendanceTimeConfirmation, saveAttendanceTimeConfirmationSchema } from "@/modules/hr"

export const PUT = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}))
  const parsed = saveAttendanceTimeConfirmationSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("ข้อมูลเวลายืนยันไม่ถูกต้อง")
  const data = await saveAttendanceTimeConfirmation(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    ...parsed.data,
  })
  return Response.json({ data })
})
