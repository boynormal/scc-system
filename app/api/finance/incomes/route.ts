import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import { createIncome, createIncomeSchema, listIncomes } from "@/modules/finance"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "read")
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const result = await listIncomes(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
    incomeTypeId: searchParams.get("incomeTypeId"),
    costCenterId: searchParams.get("costCenterId"),
    processId: searchParams.get("processId"),
    status: searchParams.get("status"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    search: searchParams.get("search"),
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "create")
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = createIncomeSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ValidationError(first ? `ข้อมูลไม่ถูกต้อง (${first.path.join(".") || "payload"})` : "ข้อมูลไม่ถูกต้อง")
  }

  const result = await createIncome(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
