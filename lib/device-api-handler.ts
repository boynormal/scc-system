import type { NextRequest } from "next/server"
import { prisma } from "@/shared/db"
import { AppError } from "@/lib/errors"
import { authenticateDevice, type AuthenticatedDevice } from "@/modules/hr"

/** สำหรับโปรแกรมสาขา — ยืนยันตัวด้วย `Authorization: Bearer <device key>` แทน session */
export function withDeviceAuth(
  handler: (req: NextRequest, device: AuthenticatedDevice) => Promise<Response>
): (req: NextRequest) => Promise<Response> {
  return async (req: NextRequest) => {
    try {
      const device = await authenticateDevice(prisma, req.headers.get("authorization"))
      return await handler(req, device)
    } catch (e) {
      if (e instanceof AppError) {
        return Response.json({ error: e.message, code: e.code }, { status: e.status })
      }
      console.error("[Device API Error]", e)
      return Response.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 })
    }
  }
}
