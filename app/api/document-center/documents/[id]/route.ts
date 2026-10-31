import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import { getDocument, softDeleteDocument, updateDocument, updateDocumentSchema } from "@/modules/document_center"

async function actor(session: { user: { companyId?: string; id?: string; roles?: unknown } }, id: string) {
  return {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
  }
}

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "read")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await getDocument(prisma, await actor(session, id))
  return Response.json(result)
})

export const PATCH = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "update")
  if (denied) return denied
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  }
  const parsed = updateDocumentSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("ข้อมูลไม่ถูกต้อง")
  const result = await updateDocument(prisma, {
    ...(await actor(session, id)),
    input: parsed.data,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})

export const DELETE = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "delete")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await softDeleteDocument(prisma, { ...(await actor(session, id)), audit: requestAuditMeta(req) })
  return Response.json(result)
})
