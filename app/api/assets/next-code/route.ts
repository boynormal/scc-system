import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { suggestNextAssetCode } from "@/modules/assets"

export const GET = withAuth(async (_req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "read")
  if (denied) return denied
  const result = await suggestNextAssetCode(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
  })
  return Response.json(result)
})
