import { withAuth } from "@/lib/api-handler"
import { prisma } from "@/shared/db"
import { fetchNormalizedGps, persistVehicleGpsSnapshots } from "@/modules/transport/application/gps-service"
import { graceFillPunchOdometers } from "@/modules/transport/application/job-punch-service"

/** @deprecated import type จาก `@/modules/transport/application/gps-service` แทน — เก็บ re-export ไว้ให้ import เดิมยังใช้ได้ */
export type { ActiveJobInfo, GpsVehicleData } from "@/modules/transport/application/gps-service"

export const GET = withAuth(async (_req, _ctx, session) => {
  const apiUrl = process.env.GPS_API_URL
  const apiAuth = process.env.GPS_API_AUTH
  const assetId = process.env.GPS_ASSET_ID

  if (!apiUrl || !apiAuth || !assetId) {
    return Response.json({ error: "GPS API not configured", code: "GPS_NOT_CONFIGURED" }, { status: 503 })
  }

  const companyId = session.user.companyId as string

  try {
    const normalized = await fetchNormalizedGps(prisma, companyId)
    const readAt = new Date()
    await persistVehicleGpsSnapshots(prisma, normalized, readAt)
    await graceFillPunchOdometers(prisma, companyId, normalized, readAt)
    return Response.json({ data: normalized, fetchedAt: readAt.toISOString() })
  } catch (err) {
    console.error("[GPS Proxy] fetch error", err)
    return Response.json({ error: "Failed to fetch GPS data", code: "GPS_FETCH_ERROR" }, { status: 502 })
  }
})
