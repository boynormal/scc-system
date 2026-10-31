import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { readDocumentFile } from "@/modules/document_center"

export const runtime = "nodejs"

export const GET = withAuth(async (req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "documents", "read")
  if (denied) return denied
  const { id, versionId } = await ctx.params
  const disposition = new URL(req.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment"
  const file = await readDocumentFile(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    userId: session.user.id as string,
    id,
    versionId,
    disposition,
  })
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.length),
      "Content-Disposition": file.disposition,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  })
})
