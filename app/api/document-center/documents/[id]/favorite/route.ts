import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { setFavorite } from "@/modules/document_center"

async function run(session: { user: { companyId?: string; id?: string; roles?: unknown } }, id: string, favorite: boolean) {
  return setFavorite(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    favorite,
  })
}

export const POST = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "read")
  if (denied) return denied
  const { id } = await ctx.params
  return Response.json(await run(session, id, true))
})

export const DELETE = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "read")
  if (denied) return denied
  const { id } = await ctx.params
  return Response.json(await run(session, id, false))
})
