import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { parseAttachmentKind, uploadPurchaseFile } from "@/modules/procurement"

export const runtime = "nodejs"

export const POST = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "purchase_orders", "update")
  if (denied) return denied
  const { id } = await ctx.params
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) throw new ValidationError("ไม่พบไฟล์")
  const result = await uploadPurchaseFile(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    kind: parseAttachmentKind(form.get("kind")),
    originalName: file.name,
    body: Buffer.from(await file.arrayBuffer()),
  })
  return Response.json(result)
})
