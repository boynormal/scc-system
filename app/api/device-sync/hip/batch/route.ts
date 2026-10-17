import { prisma } from "@/shared/db"
import { withDeviceAuth } from "@/lib/device-api-handler"
import { ValidationError } from "@/lib/errors"
import { hipSyncBatchSchema, ingestHipBatch } from "@/modules/hr"

export const POST = withDeviceAuth(async (req, device) => {
  const body = await req.json().catch(() => null)
  const parsed = hipSyncBatchSchema.safeParse(body ?? {})
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new ValidationError(issue ? `ข้อมูลไม่ถูกต้อง: ${issue.path.join(".")} ${issue.message}` : "ข้อมูลไม่ถูกต้อง")
  }
  return Response.json({ data: await ingestHipBatch(prisma, device, parsed.data) })
})
