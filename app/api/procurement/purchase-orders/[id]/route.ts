import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getSourceFinanceStates } from "@/modules/finance"
import {
  deletePurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderSchema,
} from "@/modules/procurement"

export const GET = withAuth(async (_req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "purchase_orders", "read")
  if (denied) return denied
  const companyId = session.user.companyId as string
  const { id } = await ctx.params
  const result = await getPurchaseOrder(prisma, { companyId, roles, id })
  let finance = null
  if (result.data.status === "RECEIVED") {
    const states = await getSourceFinanceStates(prisma, {
      companyId,
      sourceModule: "PROCUREMENT",
      sourceType: "PURCHASE_ORDER",
      ids: [result.data.id],
    })
    finance = states.get(result.data.id) ?? { state: "PENDING", expenseId: null, expenseNo: null, reason: null }
  }
  return Response.json({ data: { ...result.data, finance } })
})

export const PATCH = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "purchase_orders", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = updatePurchaseOrderSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ValidationError(first?.message ?? "ข้อมูลไม่ถูกต้อง")
  }
  const result = await updatePurchaseOrder(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    input: parsed.data,
  })
  return Response.json(result)
})

export const DELETE = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "purchase_orders", "delete")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await deletePurchaseOrder(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
  })
  return Response.json(result)
})
