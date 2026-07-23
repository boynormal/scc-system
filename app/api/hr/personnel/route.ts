import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import { listPersonnel, createPersonnel, createPersonnelSchema } from "@/modules/hr"

export const GET = withAuth(async (req, _ctx, session) => {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get("branchId")
  const search = searchParams.get("search")
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)))

  const result = await listPersonnel(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    branchId,
    search,
    page,
    pageSize,
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("Invalid body")
  }
  const parsed = createPersonnelSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("Invalid body")

  const row = await createPersonnel(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as never,
    input: parsed.data,
  })
  return Response.json({ data: row })
})
