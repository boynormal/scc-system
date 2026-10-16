import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { removeExpenseAttachment } from "@/modules/finance"

export const runtime = "nodejs"

export const DELETE = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "update")
  if (denied) return denied
  const { id, attachmentId } = await ctx.params
  const result = await removeExpenseAttachment(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    attachmentId,
  })
  return Response.json(result)
})
