import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createExpense, createExpenseSchema, listExpenses } from "@/modules/finance"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "read")
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const result = await listExpenses(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
    expenseTypeId: searchParams.get("expenseTypeId"),
    costCenterId: searchParams.get("costCenterId"),
    status: searchParams.get("status"),
    sourceModule: searchParams.get("sourceModule"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    search: searchParams.get("search"),
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "create")
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ValidationError(first ? `ข้อมูลไม่ถูกต้อง (${first.path.join(".") || "payload"})` : "ข้อมูลไม่ถูกต้อง")
  }

  const result = await createExpense(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    input: parsed.data,
  })
  return Response.json(result)
})
