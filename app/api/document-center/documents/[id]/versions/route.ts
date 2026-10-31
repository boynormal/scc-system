import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { requestAuditMeta } from "@/lib/request-audit"
import { addDocumentVersion, getDocument } from "@/modules/document_center"

export const runtime = "nodejs"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "read")
  if (denied) return denied
  const { id } = await ctx.params
  const result = await getDocument(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
  })
  return Response.json({ data: result.versions })
})

export const POST = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "update")
  if (denied) return denied
  const { id } = await ctx.params
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) throw new ValidationError("ไม่พบไฟล์")
  const note = form.get("changeNote")
  const result = await addDocumentVersion(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    originalName: file.name,
    body: Buffer.from(await file.arrayBuffer()),
    changeNote: typeof note === "string" ? note : null,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
