import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { createVehicleType, createVehicleTypeSchema, listVehicleTypes } from "@/modules/transport"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const data = await listVehicleTypes(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    activeOnly: searchParams.get("activeOnly") === "1",
  })
  return Response.json({ data })
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json()
  const parsed = createVehicleTypeSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const data = await createVehicleType(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data }, { status: 201 })
})
