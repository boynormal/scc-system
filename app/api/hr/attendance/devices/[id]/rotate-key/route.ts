import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { rotateAttendanceDeviceKey } from "@/modules/hr"

type Ctx = { params: Promise<{ id: string }> }

export const POST = withAuth<Ctx>(async (_req, ctx, session) => {
  const { id } = await ctx.params
  const data = await rotateAttendanceDeviceKey(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
  })
  return Response.json({ data })
})
