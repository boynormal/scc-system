import { z } from "zod"
import type { Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { readBranchSharing } from "@/shared/permissions/branch-sharing"
import { incomeWhere } from "./income-service"

const REPORT_STATUSES = ["DRAFT", "PENDING", "APPROVED", "RECEIVED"] as const
const EXCLUDED_STATUSES = ["CANCELLED", "REJECTED"] as const
const NONE_KEY = "none"
const REPORT_ROW_LIMIT = 10000

function canIncomesRead(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "incomes", "read"))
  )
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return d
}

function optionalUuid(value?: string | null): string | null {
  if (!value?.trim()) return null
  const parsed = z.string().uuid().safeParse(value.trim())
  return parsed.success ? parsed.data : null
}

export type IncomeReportBucket = {
  key: string
  label: string
  total: number
  count: number
  percent: number
}

export type IncomeReportData = {
  grandTotal: number
  count: number
  lineCount: number
  receivedTotal: number
  outstandingTotal: number
  byType: IncomeReportBucket[]
  byCostCenter: IncomeReportBucket[]
  byBranch: IncomeReportBucket[]
  byMonth: IncomeReportBucket[]
}

export type IncomeReportLine = {
  netAmount: number
  incomeTypeId: string
  incomeTypeCode?: string | null
  incomeTypeName: string
  costCenterId: string | null
  costCenterName?: string | null
}

export type IncomeReportRow = {
  id: string
  status: string
  branchId: string
  branchName: string
  incomeDate: Date | string
  lines: IncomeReportLine[]
}

export type IncomeReportFilters = {
  incomeTypeId?: string | null
  costCenterId?: string | null
}

function addTo(map: Map<string, IncomeReportBucket>, key: string, label: string, amount: number) {
  const current = map.get(key)
  if (current) {
    current.total = round2(current.total + amount)
    current.count += 1
  } else {
    map.set(key, { key, label, total: round2(amount), count: 1, percent: 0 })
  }
}

function finish(map: Map<string, IncomeReportBucket>, grandTotal: number, byKey = false): IncomeReportBucket[] {
  const list = Array.from(map.values())
  list.sort(byKey ? (a, b) => (a.key < b.key ? -1 : 1) : (a, b) => b.total - a.total)
  return list.map((b) => ({ ...b, percent: grandTotal > 0 ? round2((b.total / grandTotal) * 100) : 0 }))
}

function matchesIdFilter(value: string | null, filter?: string | null): boolean {
  const f = filter?.trim()
  if (!f) return true
  if (f === NONE_KEY) return value == null
  return value === f
}

function monthKey(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Money is SUM of matching IncomeLine.netAmount; bill count is distinct incomes owning those lines. */
export function aggregateIncomeReport(rows: IncomeReportRow[], filters: IncomeReportFilters = {}): IncomeReportData {
  const byType = new Map<string, IncomeReportBucket>()
  const byCostCenter = new Map<string, IncomeReportBucket>()
  const byBranch = new Map<string, IncomeReportBucket>()
  const byMonth = new Map<string, IncomeReportBucket>()
  const billIds = new Set<string>()
  let grandTotal = 0
  let receivedTotal = 0
  let lineCount = 0

  for (const row of rows) {
    if ((EXCLUDED_STATUSES as readonly string[]).includes(row.status)) continue
    const month = monthKey(row.incomeDate)
    for (const line of row.lines) {
      if (filters.incomeTypeId?.trim() && line.incomeTypeId !== filters.incomeTypeId.trim()) continue
      if (!matchesIdFilter(line.costCenterId, filters.costCenterId)) continue
      const amount = Number(line.netAmount) || 0
      grandTotal = round2(grandTotal + amount)
      if (row.status === "RECEIVED") receivedTotal = round2(receivedTotal + amount)
      lineCount += 1
      billIds.add(row.id)
      const code = line.incomeTypeCode?.trim()
      addTo(byType, line.incomeTypeId, code ? `${code} · ${line.incomeTypeName}` : line.incomeTypeName, amount)
      addTo(byCostCenter, line.costCenterId ?? NONE_KEY, line.costCenterId ? (line.costCenterName ?? line.costCenterId) : "ไม่ระบุหน่วยงาน", amount)
      addTo(byBranch, row.branchId, row.branchName, amount)
      addTo(byMonth, month, month, amount)
    }
  }

  return {
    grandTotal,
    count: billIds.size,
    lineCount,
    receivedTotal,
    outstandingTotal: round2(grandTotal - receivedTotal),
    byType: finish(byType, grandTotal),
    byCostCenter: finish(byCostCenter, grandTotal),
    byBranch: finish(byBranch, grandTotal),
    byMonth: finish(byMonth, grandTotal, true),
  }
}

export const incomeReportQuerySchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  dateFrom: z.string().nullable().optional(),
  dateTo: z.string().nullable().optional(),
  incomeTypeId: z.string().uuid().nullable().optional(),
  costCenterId: z.string().nullable().optional(),
  status: z.enum(REPORT_STATUSES).nullable().optional(),
})

export async function getIncomeReport(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    incomeTypeId?: string | null
    costCenterId?: string | null
    status?: string | null
  }
) {
  if (!canIncomesRead(params.roles)) throw new ForbiddenError()
  const shareView = (await readBranchSharing(db, params.companyId)).finance.view
  const where: Prisma.IncomeWhereInput = {
    ...incomeWhere(params.companyId, params.roles, params.branchId, shareView),
    status: { notIn: [...EXCLUDED_STATUSES] },
  }
  if (params.dateFrom?.trim() || params.dateTo?.trim()) {
    const range: Prisma.DateTimeFilter = {}
    if (params.dateFrom?.trim()) range.gte = parseDateOnly(params.dateFrom.trim())
    if (params.dateTo?.trim()) range.lte = parseDateOnly(params.dateTo.trim())
    where.incomeDate = range
  }
  const status = params.status?.trim()
  if (status && (REPORT_STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof REPORT_STATUSES)[number]
  }

  const filters: IncomeReportFilters = {
    incomeTypeId: optionalUuid(params.incomeTypeId),
    costCenterId: params.costCenterId?.trim() === NONE_KEY ? NONE_KEY : optionalUuid(params.costCenterId),
  }
  const lineSome: Prisma.IncomeLineWhereInput = {}
  if (filters.incomeTypeId) lineSome.incomeTypeId = filters.incomeTypeId
  if (filters.costCenterId) lineSome.costCenterId = filters.costCenterId === NONE_KEY ? null : filters.costCenterId
  if (Object.keys(lineSome).length) where.lines = { some: lineSome }

  const rows = await db.income.findMany({
    where,
    orderBy: [{ incomeDate: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      branchId: true,
      incomeDate: true,
      branch: { select: { name: true } },
      lines: {
        select: {
          netAmount: true,
          incomeTypeId: true,
          incomeType: { select: { code: true, name: true } },
          costCenterId: true,
          costCenter: { select: { name: true } },
        },
      },
    },
    take: REPORT_ROW_LIMIT + 1,
  })

  const truncated = rows.length > REPORT_ROW_LIMIT
  const mapped: IncomeReportRow[] = rows.slice(0, REPORT_ROW_LIMIT).map((r) => ({
    id: r.id,
    status: r.status,
    branchId: r.branchId,
    branchName: r.branch.name,
    incomeDate: r.incomeDate,
    lines: r.lines.map((l) => ({
      netAmount: Number(l.netAmount),
      incomeTypeId: l.incomeTypeId,
      incomeTypeCode: l.incomeType.code,
      incomeTypeName: l.incomeType.name,
      costCenterId: l.costCenterId,
      costCenterName: l.costCenter?.name ?? null,
    })),
  }))

  return { data: aggregateIncomeReport(mapped, filters), meta: { truncated, limit: REPORT_ROW_LIMIT } }
}
