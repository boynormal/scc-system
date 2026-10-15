import { prisma } from "@/shared/db"
import { AppError, NotFoundError, ValidationError } from "@/lib/errors"
import { getPublicAssetPm, isPmPublicToken, submitPublicAssetPmRound } from "@/modules/assets"

function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error("[API Error]", error)
  return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 })
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    if (!isPmPublicToken(token)) throw new NotFoundError("ไม่พบรายการ")
    const result = await getPublicAssetPm(prisma, token)
    return Response.json(result)
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    if (!isPmPublicToken(token)) throw new NotFoundError("ไม่พบรายการ")
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw new ValidationError("ข้อมูลไม่ถูกต้อง")
    }
    const result = await submitPublicAssetPmRound(prisma, token, body)
    return Response.json(result)
  } catch (error) {
    return jsonError(error)
  }
}
