import { z } from "zod"
import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { markSourceNoExpense } from "@/modules/finance"

const bodySchema = z.object({
  sourceType: z.enum(["TRANSPORT_REPAIR", "TRANSPORT_TIRE", "TRANSPORT_JOB"]),
  sourceDocumentId: z.string().min(1).max(64),
  sourceLineId: z.string().max(64).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
})

export const POST = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const deniedCreate = forbidUnlessPermission(roles, "expenses", "create")
  const deniedUpdate = forbidUnlessPermission(roles, "expenses", "update")
  if (deniedCreate && deniedUpdate) return deniedCreate

  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  }

  const result = await markSourceNoExpense(prisma, {
    companyId: session.user.companyId as string,
    roles,
    userId: session.user.id as string,
    input: parsed.data,
  })
  return Response.json(result)
})
