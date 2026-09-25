import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { requestAuditMeta } from "@/lib/request-audit"
import { createDutyCategory, createDutyCategorySchema } from "@/modules/hr"

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}))
  const parsed = createDutyCategorySchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("ชื่อหมวดไม่ถูกต้อง")
  const result = await createDutyCategory(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result, { status: 201 })
})
