import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { mapAttendanceBadge, mapAttendanceBadgeSchema } from "@/modules/hr"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const parsed = mapAttendanceBadgeSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("ข้อมูลพนักงานไม่ถูกต้อง")
  const data = await mapAttendanceBadge(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    badgeId: id,
    personnelId: parsed.data.personnelId,
  })
  return Response.json({ data })
})
