import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import { unreceiveIncome, unreceiveIncomeSchema } from "@/modules/finance"

export const POST = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const parsed = unreceiveIncomeSchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("กรุณาระบุเหตุผลในการยกเลิกการรับเงิน")
  const result = await unreceiveIncome(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
