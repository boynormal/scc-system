import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { parseOrThrow, reverseFuelSchema, reverseFuelTransaction } from "@/modules/fuel"

export const POST = withAuth(async (req, ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const denied = forbidUnlessPermission(roles, "fuel", "approve")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const result = await reverseFuelTransaction(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    id,
    input: parseOrThrow(reverseFuelSchema, body),
  })
  return Response.json(result)
})
