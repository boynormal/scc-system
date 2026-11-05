import { prisma } from "@/shared/db"
import { AppError, NotFoundError, ValidationError } from "@/lib/errors"
import { getPublicPickupPage, isPickupPublicToken, submitPublicPickupRequest } from "@/modules/transport"

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
    if (!isPickupPublicToken(token)) throw new NotFoundError("ไม่พบลิงก์นี้")
    const data = await getPublicPickupPage(prisma, token)
    return Response.json({ data })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params
    if (!isPickupPublicToken(token)) throw new NotFoundError("ไม่พบลิงก์นี้")
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw new ValidationError("ข้อมูลไม่ถูกต้อง")
    }
    const data = await submitPublicPickupRequest(prisma, token, body)
    return Response.json({ data }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
