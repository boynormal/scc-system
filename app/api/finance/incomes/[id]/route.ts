import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import { deleteIncome, getIncome, updateIncome, updateIncomeSchema } from "@/modules/finance"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "read")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await getIncome(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
  })
  return Response.json(result)
})

export const PATCH = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = updateIncomeSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ValidationError(first ? `ข้อมูลไม่ถูกต้อง (${first.path.join(".") || "payload"})` : "ข้อมูลไม่ถูกต้อง")
  }
  const result = await updateIncome(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})

export const DELETE = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "delete")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await deleteIncome(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
