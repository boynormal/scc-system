import { prisma } from "@/shared/db"
import { withAuth } from "@/lib/api-handler"
import type { UserRole } from "@/lib/permissions"
import { forbidUnlessPermission } from "@/lib/require-permission"
import { getAssetPmTemplateItemAudio } from "@/modules/assets"

export const GET = withAuth(async (_req, ctx, session) => {
  const denied = forbidUnlessPermission(session.user.roles as UserRole[], "assets", "read")
  if (denied) return denied
  const { id, itemId } = await ctx.params
  const audio = await getAssetPmTemplateItemAudio(prisma, {
    companyId: session.user.companyId as string,
    roles: session.user.roles as UserRole[],
    templateId: id,
    itemId,
  })
  return new Response(new Uint8Array(audio.bytes), {
    headers: {
      "Content-Type": audio.contentType,
      "Content-Length": String(audio.bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  })
})
