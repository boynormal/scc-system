import type { PrismaClient } from "@prisma/client"

type WoNumberDb = Pick<PrismaClient, "workOrder"> & {
  $executeRaw?: PrismaClient["$executeRaw"]
}

/**
 * สร้างเลข WO ต่อสาขา ถ้าเรียกใน transaction จะล็อกเลขของสาขานั้นจนจบธุรกรรม
 */
export async function generateWONumber(db: WoNumberDb, branchId: string): Promise<string> {
  if (db.$executeRaw) {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wo:${branchId}`}))`
  }
  const year = new Date().getFullYear()
  const prefix = `WO-${year}-`
  const count = await db.workOrder.count({
    where: { branchId, woNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(5, "0")}`
}
