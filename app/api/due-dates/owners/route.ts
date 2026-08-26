import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listDueItemOwners } from "@/modules/due_dates"

export const GET = withAuth(async (_req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "due_dates", "read")
  if (denied) return denied
  const result = await listDueItemOwners(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
  })
  return Response.json(result)
})
