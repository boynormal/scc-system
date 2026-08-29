import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

function canExpensesRead(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "expenses", "read"))
  )
}

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return d
}

function reportWhere(
  companyId: string,
  roles: UserRole[],
  branchId?: string | null
): Prisma.ExpenseWhereInput {
  const isAdmin = isAdminInAnyBranch(roles)
  const allowed = getBranchIds(roles)
  const base: Prisma.ExpenseWhereInput = {
    companyId,
    deletedAt: null,
    status: { notIn: ["CANCELLED", "REJECTED"] },
  }
  if (branchId) {
    if (!isAdmin && !allowed.includes(branchId)) {
      return { id: "00000000-0000-0000-0000-000000000000" }
    }
    return { ...base, branchId }
  }
  if (!isAdmin) {
    return {
      ...base,
      branchId: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] },
    }
  }
  return base
}

type Bucket = { key: string; label: string; total: number; count: number }

function addTo(map: Map<string, Bucket>, key: string, label: string, amount: number) {
  const current = map.get(key)
  if (current) {
    current.total = Math.round((current.total + amount) * 100) / 100
    current.count += 1
  } else {
    map.set(key, { key, label, total: Math.round(amount * 100) / 100, count: 1 })
  }
}

function sortBuckets(map: Map<string, Bucket>): Bucket[] {
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export const expenseReportQuerySchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  dateFrom: z.string().nullable().optional(),
  dateTo: z.string().nullable().optional(),
})

export async function getExpenseReport(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    dateFrom?: string | null
    dateTo?: string | null
  }
) {
  if (!canExpensesRead(params.roles)) throw new ForbiddenError()
  const where = reportWhere(params.companyId, params.roles, params.branchId)
  if (params.dateFrom?.trim() || params.dateTo?.trim()) {
    const range: Prisma.DateTimeFilter = {}
    if (params.dateFrom?.trim()) range.gte = parseDateOnly(params.dateFrom.trim())
    if (params.dateTo?.trim()) range.lte = parseDateOnly(params.dateTo.trim())
    where.expenseDate = range
  }

  // Header grain: branch, month and document count come from the expense header.
  // Line grain: type, cost center and source module come from each ExpenseLine so
  // a multi-line bill contributes to several buckets but is still counted once.
  const rows = await db.expense.findMany({
    where,
    select: {
      netAmount: true,
      branchId: true,
      expenseDate: true,
      branch: { select: { name: true } },
      lines: {
        select: {
          netAmount: true,
          sourceModule: true,
          costCenterId: true,
          costCenter: { select: { name: true } },
          expenseTypeId: true,
          expenseType: { select: { name: true } },
        },
      },
    },
    take: 10000,
  })

  const byModule = new Map<string, Bucket>()
  const byBranch = new Map<string, Bucket>()
  const byCostCenter = new Map<string, Bucket>()
  const byType = new Map<string, Bucket>()
  const byMonth = new Map<string, Bucket>()
  let grandTotal = 0

  for (const r of rows) {
    const headerAmount = Number(r.netAmount)
    addTo(byBranch, r.branchId, r.branch.name, headerAmount)
    const month = `${r.expenseDate.getUTCFullYear()}-${String(r.expenseDate.getUTCMonth() + 1).padStart(2, "0")}`
    addTo(byMonth, month, month, headerAmount)

    for (const line of r.lines) {
      const amount = Number(line.netAmount)
      grandTotal = Math.round((grandTotal + amount) * 100) / 100
      addTo(byModule, line.sourceModule ?? "MANUAL", line.sourceModule ?? "MANUAL", amount)
      addTo(
        byCostCenter,
        line.costCenterId ?? "none",
        line.costCenter?.name ?? "ไม่ระบุหน่วยงาน",
        amount
      )
      addTo(byType, line.expenseTypeId, line.expenseType.name, amount)
    }
  }

  return {
    data: {
      grandTotal,
      count: rows.length,
      byModule: sortBuckets(byModule),
      byBranch: sortBuckets(byBranch),
      byCostCenter: sortBuckets(byCostCenter),
      byType: sortBuckets(byType),
      byMonth: Array.from(byMonth.values()).sort((a, b) => (a.key < b.key ? -1 : 1)),
    },
  }
}
