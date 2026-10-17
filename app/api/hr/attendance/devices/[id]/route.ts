import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { updateAttendanceDevice, updateAttendanceDeviceSchema } from "@/modules/hr"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const parsed = updateAttendanceDeviceSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "ข้อมูลเครื่องสแกนไม่ถูกต้อง")
  const data = await updateAttendanceDevice(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    input: parsed.data,
  })
  return Response.json({ data })
})
