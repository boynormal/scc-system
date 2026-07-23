import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { listVehicles, createVehicle, createVehicleSchema } from "@/modules/transport"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const status = searchParams.get("status") as Parameters<typeof listVehicles>[1]["status"]
  const search = searchParams.get("search")

  const data = await listVehicles(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    branchId,
    status,
    search,
    includeInactive: searchParams.get("includeInactive") === "true",
  })
  return Response.json({ data })
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = createVehicleSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await createVehicle(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})
