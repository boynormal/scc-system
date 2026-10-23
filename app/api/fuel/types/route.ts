import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createFuelType, createFuelTypeSchema, listFuelTypes, parseOrThrow } from "@/modules/fuel"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "fuel", "read")
  if (denied) return denied
  const { searchParams } = new URL(req.url)
  const result = await listFuelTypes(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    activeOnly: searchParams.get("activeOnly") === "1",
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
  const result = await createFuelType(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parseOrThrow(createFuelTypeSchema, body),
  })
  return Response.json(result)
})
