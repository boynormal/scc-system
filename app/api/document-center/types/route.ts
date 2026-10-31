import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { createType, createTypeSchema, listTypes } from "@/modules/document_center"

export const GET = withAuth(async (req, _ctx, session) => {
  const roles = session.user.roles as UserRole[]
  const deniedDocs = forbidUnlessPermission(roles, "documents", "read")
  const deniedMasters = forbidUnlessPermission(roles, "document_masters", "read")
  if (deniedDocs && deniedMasters) return deniedMasters
  const result = await listTypes(prisma, {
    companyId: session.user.companyId as string,
    roles,
    activeOnly: new URL(req.url).searchParams.get("active") === "1",
  })
  return Response.json(result)
})

export const POST = withAuth(async (req, _ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "document_masters", "create")
  if (denied) return denied
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  }
  const parsed = createTypeSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  const result = await createType(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    input: parsed.data,
  })
  return Response.json(result)
})
