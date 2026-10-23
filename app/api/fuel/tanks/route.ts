import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createFuelTank, createFuelTankSchema, listFuelTanks, parseOrThrow } from "@/modules/fuel"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "fuel", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await listFuelTanks(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    branchId: searchParams.get("branchId"),
    fuelTypeId: searchParams.get("fuelTypeId"),
    activeOnly: searchParams.get("activeOnly") === "1",
    search: searchParams.get("search"),
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "fuel", "create")
  if (denied) return denied
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const result = await createFuelTank(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parseOrThrow(createFuelTankSchema, body),
  })
  return Response.json(result)
})
