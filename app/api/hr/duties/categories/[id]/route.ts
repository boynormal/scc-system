import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { requestAuditMeta } from "@/lib/request-audit"
import { deleteDutyCategory, updateDutyCategory, updateDutyCategorySchema } from "@/modules/hr"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const parsed = updateDutyCategorySchema.safeParse(body ?? {})
  if (!parsed.success) throw new ValidationError("ข้อมูลหมวดไม่ถูกต้อง")
  const result = await updateDutyCategory(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})

export const DELETE = withAuth<Ctx>(async (req, ctx, session) => {
  const { id } = await ctx.params
  const result = await deleteDutyCategory(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
