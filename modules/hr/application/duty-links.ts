import type { Prisma, PrismaClient } from "@prisma/client"
import { ValidationError } from "@/lib/errors"

/**
 * ติ๊กข้อใหม่ได้เฉพาะข้อที่ยังใช้งาน ข้อที่ปิดแล้วคงไว้ได้ถ้าเดิมติ๊กอยู่
 * เพื่อไม่ให้การบันทึกทิ้งข้อเงียบๆ และไม่ให้เพิ่มข้อที่เลิกใช้แล้ว
 */
export async function assertDutyItemsAllowed(
  db: PrismaClient | Prisma.TransactionClient,
  params: { companyId: string; dutyItemIds: string[]; alreadyLinked: string[] }
): Promise<string[]> {
  const ids = [...new Set(params.dutyItemIds)]
  if (ids.length === 0) return ids
  const rows = await db.dutyItem.findMany({
    where: { id: { in: ids }, category: { companyId: params.companyId } },
    select: { id: true, isActive: true, category: { select: { isActive: true } } },
  })
  if (rows.length !== ids.length) throw new ValidationError("รายการหน้าที่ไม่ถูกต้อง")
  const kept = new Set(params.alreadyLinked)
  if (rows.some((row) => (!row.isActive || !row.category.isActive) && !kept.has(row.id))) {
    throw new ValidationError("รายการหน้าที่นี้ถูกปิดใช้งานแล้ว")
  }
  return ids
}
