import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createIncomeCategory, incomeCategorySchema, listIncomeCategories } from "@/modules/finance"

export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied =
    forbidUnlessPermission(roles, "incomes", "read") && forbidUnlessPermission(roles, "expense_masters", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await listIncomeCategories(prisma, {
    companyId: session.user.companyId as string,
    roles,
    includeInactive: searchParams.get("includeInactive") === "1",
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expense_masters", "create")
  if (denied) return denied
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = incomeCategorySchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  const result = await createIncomeCategory(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parsed.data,
  })
  return Response.json(result)
})
