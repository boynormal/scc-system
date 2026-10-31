import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { deleteCategory, updateCategory, updateCategorySchema } from "@/modules/document_center"

export const PATCH = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "document_masters", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  }
  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  const result = await updateCategory(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
    input: parsed.data,
  })
  return Response.json(result)
})

export const DELETE = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "document_masters", "delete")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await deleteCategory(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
  })
  return Response.json(result)
})
