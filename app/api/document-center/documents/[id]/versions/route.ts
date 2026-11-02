import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
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
  const upload = file instanceof File && file.size > 0 ? file : null
  const note = form.get("changeNote")
  const announcement = form.get("announcement")
  const result = await addDocumentVersion(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    announcement: typeof announcement === "string" ? announcement : null,
    originalName: upload?.name ?? null,
    body: upload ? Buffer.from(await upload.arrayBuffer()) : null,
    changeNote: typeof note === "string" ? note : null,
    audit: requestAuditMeta(req),
  })
  return Response.json(result)
})
