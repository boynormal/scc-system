import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { addExpenseAttachment, expenseAttachmentInputSchema } from "@/modules/finance"

export const POST = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = expenseAttachmentInputSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลไฟล์ไม่ถูกต้อง")

  const result = await addExpenseAttachment(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    input: parsed.data,
  })
  return Response.json(result)
})
