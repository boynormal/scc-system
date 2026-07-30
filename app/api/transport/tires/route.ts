import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import {
  listTireLogs,
  createTireLog,
  createTireLogSchema,
  getVehicleWheelLayout,
} from "@/modules/transport"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const layoutVehicleId = searchParams.get("layoutVehicleId")

  if (layoutVehicleId) {
    const data = await getVehicleWheelLayout(prisma, {
      companyId: session.user.companyId as string,
      roles: session.user.roles as never,
      vehicleId: layoutVehicleId,
    })
    return Response.json({ data })
  }

  const result = await listTireLogs(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    vehicleId: searchParams.get("vehicleId"),
    branchId: searchParams.get("branchId"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  })
  return Response.json({ data: result.items, meta: result.meta })
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = createTireLogSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await createTireLog(prisma, {
    companyId: session.user.companyId as string,
    userId: session.user.id as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})
