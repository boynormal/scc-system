import type { PrismaClient } from "@prisma/client"

/**
 * สร้างเลข WO ต่อสาขา — ดึงออกจาก route เป็น use-case ชั้น application
 */
export async function generateWONumber(
  db: Pick<PrismaClient, "workOrder">,
  branchId: string
): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `WO-${year}-`
  const count = await db.workOrder.count({
    where: { branchId, woNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(5, "0")}`
}
