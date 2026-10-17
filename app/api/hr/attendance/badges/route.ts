import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { listAttendanceBadges, type BadgeListFilter } from "@/modules/hr"

const FILTERS: BadgeListFilter[] = ["unmapped", "mapped", "all"]

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  if (!branchId) throw new ValidationError("ต้องระบุ branchId")
  const rawFilter = searchParams.get("filter") ?? "unmapped"
  const filter = FILTERS.includes(rawFilter as BadgeListFilter) ? (rawFilter as BadgeListFilter) : "unmapped"
  const data = await listAttendanceBadges(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId,
    filter,
  })
  return Response.json({ data })
})
