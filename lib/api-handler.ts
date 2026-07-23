import type { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { AppError } from "@/lib/errors"

export function withAuth<TCtx = { params: Promise<Record<string, string>> }>(
  handler: (req: NextRequest, ctx: TCtx, session: Session) => Promise<Response>
): (req: NextRequest, ctx: TCtx) => Promise<Response> {
  return async (req: NextRequest, ctx: TCtx) => {
    const session = (await auth()) as Session | null
    if (!session) {
      return Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
    }
    try {
      return await handler(req, ctx, session)
    } catch (e) {
      if (e instanceof AppError) {
        return Response.json({ error: e.message, code: e.code }, { status: e.status })
      }
      console.error("[API Error]", e)
      return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 })
    }
  }
}
