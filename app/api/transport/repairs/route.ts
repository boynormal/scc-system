import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import {
  listRepairs,
  countOpenRepairsByStatus,
  createRepair,
  createRepairSchema,
} from "@/modules/transport"
import type { TransportRepairStatus } from "@prisma/client"

const VALID_STATUSES = new Set<TransportRepairStatus>([
  "reported",
  "in_repair",
  "inspection",
  "closed",
  "cancelled",
])

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const vehicleId = searchParams.get("vehicleId")
  const branchId = searchParams.get("branchId")
  const statusParam = searchParams.get("status")
  const statusGroup = searchParams.get("statusGroup")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (statusGroup && statusGroup !== "open") {
    throw new ValidationError("statusGroup must be open")
  }
  if (statusParam && !VALID_STATUSES.has(statusParam as TransportRepairStatus)) {
    throw new ValidationError("Invalid status")
  }

  const companyId = session.user.companyId as string
  const roles = session.user.roles as never

  const [result, openCounts] = await Promise.all([
    listRepairs(prisma, {
      companyId,
      roles,
      vehicleId,
      branchId,
      status: statusGroup === "open" ? null : (statusParam as TransportRepairStatus | null),
      statusGroup: statusGroup === "open" ? "open" : null,
      from,
      to,
    }),
    countOpenRepairsByStatus(prisma, {
      companyId,
      roles,
      vehicleId,
      branchId,
    }),
  ])
  return Response.json({ data: result.items, meta: result.meta, openCounts })
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = createRepairSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await createRepair(prisma, {
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})
