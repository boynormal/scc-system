import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ForbiddenError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { canReadDutyCatalog, listDutyCatalog } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  if (!canReadDutyCatalog(roles)) throw new ForbiddenError()
  const { searchParams } = new URL(req.url)
  const result = await listDutyCatalog(prisma, {
    companyId: session.user.companyId as string,
    roles,
    includeInactive: searchParams.get("includeInactive") === "true",
  })
  return Response.json(result)
})
