import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import {
  adjustFuel,
  adjustFuelSchema,
  dispenseFuel,
  dispenseFuelSchema,
  exportFuelTransactionsCsv,
  listFuelTransactions,
  parseOrThrow,
  receiveFuel,
  receiveFuelSchema,
  type FuelTxnFilter,
} from "@/modules/fuel"

function filterFrom(searchParams: URLSearchParams): FuelTxnFilter {
  return {
    branchId: searchParams.get("branchId"),
    tankId: searchParams.get("tankId"),
    type: searchParams.get("type"),
    assetId: searchParams.get("assetId"),
    targetType: searchParams.get("targetType"),
    dateFrom: searchParams.get("dateFrom"),
    dateTo: searchParams.get("dateTo"),
    search: searchParams.get("search"),
  }
}

export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "fuel", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const companyId = session.user.companyId as string

  if (searchParams.get("format") === "csv") {
    const { csv } = await exportFuelTransactionsCsv(prisma, { companyId, roles, filter: filterFrom(searchParams) })
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fuel-transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  const page = Number(searchParams.get("page") ?? "1")
  const pageSize = Number(searchParams.get("pageSize") ?? "50")
  const result = await listFuelTransactions(prisma, {
    companyId,
    roles,
    filter: filterFrom(searchParams),
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  })
  return Response.json(result)
})

/** body.kind = RECEIVE | DISPENSE | ADJUST */
export const POST = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "fuel", "create")
  if (denied) return denied
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    throw new ValidationError("Invalid body")
  }
  const params = {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
  }
  switch (body?.kind) {
    case "RECEIVE":
      return Response.json(await receiveFuel(prisma, { ...params, input: parseOrThrow(receiveFuelSchema, body) }))
    case "DISPENSE":
      return Response.json(await dispenseFuel(prisma, { ...params, input: parseOrThrow(dispenseFuelSchema, body) }))
    case "ADJUST":
      return Response.json(await adjustFuel(prisma, { ...params, input: parseOrThrow(adjustFuelSchema, body) }))
    default:
      throw new ValidationError("ประเภทรายการไม่ถูกต้อง")
  }
})
