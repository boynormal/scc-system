import { prisma } from "@/shared/db"
import { withDeviceAuth } from "@/lib/device-api-handler"
import { getHipSyncState } from "@/modules/hr"

export const GET = withDeviceAuth(async (_req, device) => {
  return Response.json({ data: await getHipSyncState(prisma, device) })
})
