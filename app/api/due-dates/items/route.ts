import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createDueItem, createDueItemSchema, listDueItems } from "@/modules/due_dates"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "due_dates", "read")
  if (denied) return denied

  const { searchParams } = new URL(req.url)
  const result = await listDueItems(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
    status: searchParams.get("status"),
    alertLevel: searchParams.get("alertLevel"),
    search: searchParams.get("search"),
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "due_dates", "create")
  if (denied) return denied

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = createDueItemSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")

  const result = await createDueItem(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    input: parsed.data,
  })
  return Response.json(result)
})
