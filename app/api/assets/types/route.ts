import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createAssetRegisterType, listAssetRegisterTypes } from "@/modules/assets"

export const GET = withAuth(async (_req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "read")
  if (denied) return denied
  const result = await listAssetRegisterTypes(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "update")
  if (denied) return denied
  let body: { name?: string }
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const result = await createAssetRegisterType(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    name: body.name ?? "",
  })
  return Response.json(result)
})
