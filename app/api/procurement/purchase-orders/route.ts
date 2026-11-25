import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getSourceFinanceStates } from "@/modules/finance"
import { createPurchaseOrder, createPurchaseOrderSchema, listPurchaseOrders } from "@/modules/procurement"

export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "purchase_orders", "read")
  if (denied) return denied
  const companyId = session.user.companyId as string
  const { searchParams } = new URL(req.url)
  const result = await listPurchaseOrders(prisma, {
    companyId,
    roles,
    branchId: searchParams.get("branchId"),
    status: searchParams.get("status"),
    supplierId: searchParams.get("supplierId"),
    search: searchParams.get("search"),
    receivedFrom: searchParams.get("from"),
    receivedTo: searchParams.get("to"),
  })
  const finance = await getSourceFinanceStates(prisma, {
    companyId,
    sourceModule: "PROCUREMENT",
    sourceType: "PURCHASE_ORDER",
    ids: result.data.filter((po) => po.status === "RECEIVED").map((po) => po.id),
  })
  return Response.json({
    counts: result.counts,
    data: result.data.map((po) => ({
      ...po,
      finance: po.status === "RECEIVED" ? (finance.get(po.id) ?? { state: "PENDING" }) : null,
    })),
  })
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "purchase_orders", "create")
  if (denied) return denied
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = createPurchaseOrderSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new ValidationError(first?.message ?? "ข้อมูลไม่ถูกต้อง")
  }
  const result = await createPurchaseOrder(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    input: parsed.data,
  })
  return Response.json(result)
})
