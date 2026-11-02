import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createAssetPmTemplate, listAssetPmTemplates } from "@/modules/assets"

export const GET = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "read")
  if (denied) return denied
  const activeOnly = new URL(req.url).searchParams.get("activeOnly") === "true"
  const result = await listAssetPmTemplates(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    activeOnly,
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "update")
  if (denied) return denied
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const result = await createAssetPmTemplate(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: body,
  })
  return Response.json(result)
})
