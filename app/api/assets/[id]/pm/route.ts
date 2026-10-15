import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getAssetPm, upsertAssetPm } from "@/modules/assets"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "read")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await getAssetPm(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    assetId: id,
  })
  return Response.json(result)
})

export const PUT = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const result = await upsertAssetPm(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    assetId: id,
    input: body,
  })
  return Response.json(result)
})
