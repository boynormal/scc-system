import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { deleteExpense, getExpense, updateExpense, updateExpenseSchema } from "@/modules/finance"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "read")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await getExpense(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
  })
  return Response.json(result)
})

export const PATCH = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ValidationError(first ? `ข้อมูลไม่ถูกต้อง (${first.path.join(".") || "payload"})` : "ข้อมูลไม่ถูกต้อง")
  }

  const result = await updateExpense(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    input: parsed.data,
  })
  return Response.json(result)
})

export const DELETE = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "delete")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await deleteExpense(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
  })
  return Response.json(result)
})
