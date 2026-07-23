import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { runLegacyTransportCodeMigration } from "@/modules/transport"
import { z } from "zod"

const bodySchema = z.object({
  target: z.enum(["drivers", "customers", "all"]).optional(),
})

export const POST = withAuth(async (req, _ctx, session) => {
  const body = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(JSON.stringify(parsed.error.flatten()))

  const result = await runLegacyTransportCodeMigration(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    target: parsed.data.target,
  })
  return Response.json({ data: result })
})

