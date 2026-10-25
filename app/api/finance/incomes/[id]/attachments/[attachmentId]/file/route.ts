import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { readIncomeAttachmentFile } from "@/modules/finance"
import { contentDispositionAttachment, contentDispositionInline } from "@/modules/storage"

export const runtime = "nodejs"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "incomes", "read")
  if (denied) return denied
  const { id, attachmentId } = await ctx.params
  const file = await readIncomeAttachmentFile(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    id,
    attachmentId,
  })
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": file.contentType.startsWith("image/")
        ? contentDispositionInline(file.originalName)
        : contentDispositionAttachment(file.originalName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  })
})
