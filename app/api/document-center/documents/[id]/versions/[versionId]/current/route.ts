import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import { setCurrentVersion } from "@/modules/document_center"

export const PATCH = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "update")
  if (denied) return denied
  const { id, versionId } = await ctx.params
  const result = await setCurrentVersion(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    versionId,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
