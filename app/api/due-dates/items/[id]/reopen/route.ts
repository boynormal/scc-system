import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { reopenDueItem } from "@/modules/due_dates"

export const POST = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "due_dates", "update")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await reopenDueItem(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
  })
  return Response.json(result)
})
