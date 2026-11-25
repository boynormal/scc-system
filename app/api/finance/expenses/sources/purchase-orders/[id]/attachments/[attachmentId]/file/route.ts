import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { readReceivedPurchaseAttachmentForFinance } from "@/modules/procurement"
import { contentDispositionAttachment, contentDispositionInline } from "@/modules/storage"

export const runtime = "nodejs"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "expenses", "read")
  if (denied) return denied
  const { id, attachmentId } = await ctx.params
  const file = await readReceivedPurchaseAttachmentForFinance(prisma, {
    companyId: session.user.companyId as string,
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
