import type { NextRequest } from "next/server"

export type RequestAuditMeta = {
  ipAddress: string | null
  userAgent: string | null
}

export function requestAuditMeta(req: NextRequest): RequestAuditMeta {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip")
  return {
    ipAddress: ip || null,
    userAgent: req.headers.get("user-agent"),
  }
}
