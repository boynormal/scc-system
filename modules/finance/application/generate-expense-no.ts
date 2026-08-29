import type { PrismaClient } from "@prisma/client"

/**
 * Generate a per-company, per-year sequential expense number: EXP-YYYY-00001.
 * Counts existing rows (including soft-deleted) with the same prefix so numbers
 * are never reused.
 */
export async function generateExpenseNo(
  db: Pick<PrismaClient, "expense">,
  companyId: string
): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `EXP-${year}-`
  const count = await db.expense.count({
    where: { companyId, expenseNo: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(5, "0")}`
}
