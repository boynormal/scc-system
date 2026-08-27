import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getDueSummary } from "@/modules/due_dates"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "due_dates", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await getDueSummary(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
    ownerUserId: searchParams.get("ownerUserId"),
  })
  return Response.json(result)
})
