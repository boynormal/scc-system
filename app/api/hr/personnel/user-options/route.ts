import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listPersonnelUserOptions } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "hr_personnel", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const currentUserId = searchParams.get("currentUserId")
  const result = await listPersonnelUserOptions(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    currentUserId,
  })
  return Response.json(result)
})
