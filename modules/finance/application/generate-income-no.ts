import type { PrismaClient } from "@prisma/client"

/**
 * Generate a per-company, per-year sequential income number: INC-YYYY-00001.
 * Counts existing rows (including soft-deleted) with the same prefix so numbers
 * are never reused.
 */
export async function generateIncomeNo(
  db: Pick<PrismaClient, "income">,
  companyId: string,
  now: Date = new Date()
): Promise<string> {
  const prefix = `INC-${now.getFullYear()}-`
  const count = await db.income.count({
    where: { companyId, incomeNo: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(5, "0")}`
}
