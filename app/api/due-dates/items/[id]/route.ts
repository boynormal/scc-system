import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getDueItem, updateDueItem, updateDueItemSchema } from "@/modules/due_dates"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "due_dates", "read")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await getDueItem(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
  })
  return Response.json(result)
})

export const PATCH = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "due_dates", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = updateDueItemSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")

  const result = await updateDueItem(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
    input: parsed.data,
  })
  return Response.json(result)
})
