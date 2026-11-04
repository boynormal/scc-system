import { prisma } from "@/shared/db"
import { AppError, NotFoundError } from "@/lib/errors"
import { getPublicAssetPmAudio, isPmPublicToken } from "@/modules/assets"

function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error("[API Error]", error)
  return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 })
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string; itemId: string }> }) {
  try {
    const { token, itemId } = await ctx.params
    if (!isPmPublicToken(token)) throw new NotFoundError("ไม่พบรายการ")
    const audio = await getPublicAssetPmAudio(prisma, token, itemId)
    return new Response(new Uint8Array(audio.bytes), {
      headers: {
        "Content-Type": audio.contentType,
        "Content-Length": String(audio.bytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}
