import { withAuth } from "@/lib/api-handler"
import { prisma } from "@/shared/db"
import { fetchGpsLookupMaps, normalizeGpsData } from "@/modules/transport/application/gps-service"

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

  const [gpsRes, maps] = await Promise.all([
    fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiAuth,
      },
      body: JSON.stringify({ asset: Number(assetId) }),
      next: { revalidate: 15 },
    }),
    fetchGpsLookupMaps(prisma, companyId),
  ])

  if (!gpsRes.ok) {
    console.error("[GPS Proxy] upstream error", gpsRes.status)
    return Response.json(
      { error: "GPS API returned error", code: "GPS_UPSTREAM_ERROR", status: gpsRes.status },
      { status: 502 }
    )
  }

  try {
    const json = await gpsRes.json()
    const rawData: Record<string, unknown>[] = json?.data ?? []
    const normalized = normalizeGpsData(rawData, maps)

    return Response.json({ data: normalized, fetchedAt: new Date().toISOString() })
  } catch (err) {
    console.error("[GPS Proxy] fetch error", err)
    return Response.json({ error: "Failed to fetch GPS data", code: "GPS_FETCH_ERROR" }, { status: 502 })
  }
})
