import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { listIncomeFormOptions } from "@/modules/finance"

export const GET = withAuth(async (_req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "read")
  if (denied) return denied
  const result = await listIncomeFormOptions(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
  })
  return Response.json(result)
})
