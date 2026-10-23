import type { PrismaClient } from "@prisma/client"
import { ValidationError } from "@/lib/errors"

const BLOCKING_WORK_ORDER_STATUSES = ["in_progress", "on_hold"] as const

/**
 * อ่านอย่างเดียว: รถที่ผูกทรัพย์สินซึ่งมีใบงานซ่อมบำรุงกำลังทำหรือพักงาน จ่ายงานขนส่งไม่ได้
 * ไม่เปลี่ยน currentStatus ของรถ
 */
export async function assertNoActiveMaintenanceWork(
  db: PrismaClient,
  vehicle: { assetId: string | null; plateNumber: string }
) {
  if (!vehicle.assetId) return
  const workOrder = await db.workOrder.findFirst({
    where: { assetId: vehicle.assetId, status: { in: [...BLOCKING_WORK_ORDER_STATUSES] } },
    select: { woNumber: true },
    orderBy: { createdAt: "desc" },
  })
  if (workOrder) {
    throw new ValidationError(
      `รถ ${vehicle.plateNumber} มีใบงานซ่อมบำรุง ${workOrder.woNumber} กำลังทำอยู่ — ปิดหรือส่งมอบใบงานก่อนจ่ายงาน`
    )
  }
}
