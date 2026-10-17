import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { searchPersonnelForBadge } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  if (!branchId) throw new ValidationError("ต้องระบุ branchId")
  const data = await searchPersonnelForBadge(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId,
    q: (searchParams.get("q") ?? "").slice(0, 100),
  })
  return Response.json({ data })
})
