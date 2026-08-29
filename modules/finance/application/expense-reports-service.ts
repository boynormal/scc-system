import { z } from "zod"
import type { ExpenseSourceModule, Prisma, PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"

const REPORT_STATUSES = ["DRAFT", "PENDING", "APPROVED", "PAID"] as const
const EXCLUDED_STATUSES = ["CANCELLED", "REJECTED"] as const
const NONE_KEY = "none"
const MANUAL_KEY = "MANUAL"

/** Same labels as finance-theme COST_OBJECT_TYPE_LABELS — kept here to avoid modules→components import. */
const COST_OBJECT_TYPE_LABELS: Record<string, string> = {
  VEHICLE: "รถ",
  MACHINE: "เครื่องจักร",
  TIRE: "ยาง",
  JOB: "งาน",
  CUSTOMER: "ลูกค้า",
  PRODUCT: "สินค้า",
  PROJECT: "โปรเจกต์",
  LOCATION: "สถานที่",
  OTHER: "อื่นๆ",
}

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

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function optionalUuid(value?: string | null): string | null {
  if (!value?.trim()) return null
  const parsed = z.string().uuid().safeParse(value.trim())
  return parsed.success ? parsed.data : null
}

export function reportWhere(
  companyId: string,
  roles: UserRole[],
  branchId?: string | null
): Prisma.ExpenseWhereInput {
  const isAdmin = isAdminInAnyBranch(roles)
  const allowed = getBranchIds(roles)
  const base: Prisma.ExpenseWhereInput = {
    companyId,
    deletedAt: null,
    status: { notIn: [...EXCLUDED_STATUSES] },
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

export type ReportBucket = {
  key: string
  label: string
  total: number
  count: number
  percent: number
  code?: string | null
}

export type ReportMatrixAxis = { key: string; label: string; code?: string | null }

export type ExpenseReportData = {
  grandTotal: number
  count: number
  lineCount: number
  avgPerBill: number
  avgPerLine: number
  byModule: ReportBucket[]
  byBranch: ReportBucket[]
  byCostCenter: ReportBucket[]
  byType: ReportBucket[]
  byProcess: ReportBucket[]
  byCostObject: ReportBucket[]
  byMonth: ReportBucket[]
  matrix: {
    processes: ReportMatrixAxis[]
    types: ReportMatrixAxis[]
    cells: Record<string, Record<string, number>>
  }
}

export type ReportLineInput = {
  netAmount: number
  taxAmount?: number
  discountAmount?: number
  sourceModule: string | null
  costCenterId: string | null
  costCenterName?: string | null
  processId: string | null
  processName?: string | null
  expenseTypeId: string
  expenseTypeCode?: string | null
  expenseTypeName: string
  costObjectType?: string | null
  costObjectId?: string | null
  costObjectLabel?: string | null
}

export type ReportRowInput = {
  id: string
  branchId: string
  branchName: string
  expenseDate: Date | string
  vendorId?: string | null
  lines: ReportLineInput[]
}

export type ReportLineFilters = {
  expenseTypeId?: string | null
  processId?: string | null
  costCenterId?: string | null
  sourceModule?: string | null
}

function addTo(map: Map<string, ReportBucket>, key: string, label: string, amount: number, code?: string | null) {
  const current = map.get(key)
  if (current) {
    current.total = round2(current.total + amount)
    current.count += 1
  } else {
    map.set(key, { key, label, total: round2(amount), count: 1, percent: 0, code: code ?? null })
  }
}

function withPercents(buckets: ReportBucket[], grandTotal: number): ReportBucket[] {
  return buckets.map((b) => ({
    ...b,
    percent: grandTotal > 0 ? round2((b.total / grandTotal) * 100) : 0,
  }))
}

function sortByTotal(map: Map<string, ReportBucket>): ReportBucket[] {
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

function typeLabel(code: string | null | undefined, name: string): string {
  const trimmed = code?.trim()
  return trimmed ? `${trimmed} · ${name}` : name
}

function costObjectKey(line: ReportLineInput): string {
  if (!line.costObjectType && !line.costObjectId && !line.costObjectLabel?.trim()) return NONE_KEY
  const idOrLabel = line.costObjectId?.trim() || line.costObjectLabel?.trim() || NONE_KEY
  return `${line.costObjectType ?? "OTHER"}:${idOrLabel}`
}

function costObjectLabel(line: ReportLineInput): string {
  if (!line.costObjectType && !line.costObjectId && !line.costObjectLabel?.trim()) return "ไม่ระบุ"
  const typeName = line.costObjectType ? (COST_OBJECT_TYPE_LABELS[line.costObjectType] ?? line.costObjectType) : ""
  const detail = line.costObjectLabel?.trim() || line.costObjectId?.trim() || ""
  return [typeName, detail].filter(Boolean).join(" ") || "ไม่ระบุ"
}

export function lineMatchesFilters(line: ReportLineInput, filters: ReportLineFilters): boolean {
  const typeId = filters.expenseTypeId?.trim()
  if (typeId && line.expenseTypeId !== typeId) return false

  const processId = filters.processId?.trim()
  if (processId === NONE_KEY) {
    if (line.processId != null) return false
  } else if (processId && line.processId !== processId) {
    return false
  }

  const ccId = filters.costCenterId?.trim()
  if (ccId && line.costCenterId !== ccId) return false

  const module = filters.sourceModule?.trim()
  if (module === MANUAL_KEY) {
    if (line.sourceModule != null) return false
  } else if (module && line.sourceModule !== module) {
    return false
  }

  return true
}

function monthKey(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Pure aggregator — money is SUM of matching line netAmount. Testable without Prisma. */
export function aggregateExpenseReport(
  rows: ReportRowInput[],
  filters: ReportLineFilters = {}
): ExpenseReportData {
  const byModule = new Map<string, ReportBucket>()
  const byBranch = new Map<string, ReportBucket>()
  const byCostCenter = new Map<string, ReportBucket>()
  const byType = new Map<string, ReportBucket>()
  const byProcess = new Map<string, ReportBucket>()
  const byCostObject = new Map<string, ReportBucket>()
  const byMonth = new Map<string, ReportBucket>()
  const cellTotals = new Map<string, number>()
  const billIds = new Set<string>()
  let grandTotal = 0
  let lineCount = 0

  for (const row of rows) {
    const month = monthKey(row.expenseDate)
    for (const line of row.lines) {
      if (!lineMatchesFilters(line, filters)) continue
      const amount = Number(line.netAmount) || 0
      grandTotal = round2(grandTotal + amount)
      lineCount += 1
      billIds.add(row.id)

      addTo(byModule, line.sourceModule ?? MANUAL_KEY, line.sourceModule ?? MANUAL_KEY, amount)
      addTo(byBranch, row.branchId, row.branchName, amount)
      addTo(byMonth, month, month, amount)
      addTo(
        byCostCenter,
        line.costCenterId ?? NONE_KEY,
        line.costCenterName ?? "ไม่ระบุหน่วยงาน",
        amount
      )
      addTo(
        byType,
        line.expenseTypeId,
        typeLabel(line.expenseTypeCode, line.expenseTypeName),
        amount,
        line.expenseTypeCode ?? null
      )
      addTo(
        byProcess,
        line.processId ?? NONE_KEY,
        line.processId ? (line.processName ?? line.processId) : "ไม่ระบุ Process",
        amount
      )
      addTo(byCostObject, costObjectKey(line), costObjectLabel(line), amount)

      const cellKey = `${line.processId ?? NONE_KEY}::${line.expenseTypeId}`
      cellTotals.set(cellKey, round2((cellTotals.get(cellKey) ?? 0) + amount))
    }
  }

  const typeBuckets = withPercents(sortByTotal(byType), grandTotal)
  const processBuckets = withPercents(sortByTotal(byProcess), grandTotal)
  const cells: Record<string, Record<string, number>> = {}
  for (const proc of processBuckets) {
    cells[proc.key] = {}
    for (const type of typeBuckets) {
      cells[proc.key][type.key] = cellTotals.get(`${proc.key}::${type.key}`) ?? 0
    }
  }

  const count = billIds.size
  return {
    grandTotal,
    count,
    lineCount,
    avgPerBill: count > 0 ? round2(grandTotal / count) : 0,
    avgPerLine: lineCount > 0 ? round2(grandTotal / lineCount) : 0,
    byModule: withPercents(sortByTotal(byModule), grandTotal),
    byBranch: withPercents(sortByTotal(byBranch), grandTotal),
    byCostCenter: withPercents(sortByTotal(byCostCenter), grandTotal),
    byType: typeBuckets,
    byProcess: processBuckets,
    byCostObject: withPercents(sortByTotal(byCostObject), grandTotal),
    byMonth: withPercents(Array.from(byMonth.values()).sort((a, b) => (a.key < b.key ? -1 : 1)), grandTotal),
    matrix: {
      processes: processBuckets.map((p) => ({ key: p.key, label: p.label })),
      types: typeBuckets.map((t) => ({ key: t.key, label: t.label, code: t.code ?? null })),
      cells,
    },
  }
}

export const expenseReportQuerySchema = z.object({
  branchId: z.string().uuid().nullable().optional(),
  dateFrom: z.string().nullable().optional(),
  dateTo: z.string().nullable().optional(),
  expenseTypeId: z.string().uuid().nullable().optional(),
  processId: z.string().nullable().optional(),
  costCenterId: z.string().uuid().nullable().optional(),
  sourceModule: z.string().nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  status: z.enum(REPORT_STATUSES).nullable().optional(),
})

export type ExpenseReportQuery = z.infer<typeof expenseReportQuerySchema>

function lineFilterWhere(filters: ReportLineFilters): Prisma.ExpenseLineWhereInput | null {
  const where: Prisma.ExpenseLineWhereInput = {}
  const typeId = optionalUuid(filters.expenseTypeId)
  if (typeId) where.expenseTypeId = typeId

  const processRaw = filters.processId?.trim()
  if (processRaw === NONE_KEY) {
    where.processId = null
  } else {
    const processId = optionalUuid(processRaw)
    if (processId) where.processId = processId
  }

  const ccId = optionalUuid(filters.costCenterId)
  if (ccId) where.costCenterId = ccId

  const module = filters.sourceModule?.trim()
  if (module === MANUAL_KEY) {
    where.sourceModule = null
  } else if (module) {
    where.sourceModule = module as ExpenseSourceModule
  }

  return Object.keys(where).length ? where : null
}

export async function getExpenseReport(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    expenseTypeId?: string | null
    processId?: string | null
    costCenterId?: string | null
    sourceModule?: string | null
    vendorId?: string | null
    status?: string | null
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

  const status = params.status?.trim()
  if (status && (REPORT_STATUSES as readonly string[]).includes(status)) {
    where.status = status as (typeof REPORT_STATUSES)[number]
  }

  const vendorId = optionalUuid(params.vendorId)
  if (vendorId) where.vendorId = vendorId

  const lineFilters: ReportLineFilters = {
    expenseTypeId: optionalUuid(params.expenseTypeId),
    processId: params.processId?.trim() === NONE_KEY ? NONE_KEY : optionalUuid(params.processId),
    costCenterId: optionalUuid(params.costCenterId),
    sourceModule: params.sourceModule?.trim() || null,
  }
  const lineSome = lineFilterWhere(lineFilters)
  if (lineSome) {
    const and = Array.isArray(where.AND) ? [...where.AND] : where.AND ? [where.AND] : []
    and.push({ lines: { some: lineSome } })
    where.AND = and
  }

  const rows = await db.expense.findMany({
    where,
    select: {
      id: true,
      vendorId: true,
      branchId: true,
      expenseDate: true,
      branch: { select: { name: true } },
      lines: {
        select: {
          netAmount: true,
          taxAmount: true,
          discountAmount: true,
          sourceModule: true,
          costCenterId: true,
          costCenter: { select: { name: true } },
          processId: true,
          process: { select: { name: true } },
          expenseTypeId: true,
          expenseType: { select: { code: true, name: true } },
          costObjectType: true,
          costObjectId: true,
          costObjectLabel: true,
        },
      },
    },
    take: 10000,
  })

  const mapped: ReportRowInput[] = rows.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchName: r.branch.name,
    expenseDate: r.expenseDate,
    vendorId: r.vendorId,
    lines: r.lines.map((l) => ({
      netAmount: Number(l.netAmount),
      taxAmount: Number(l.taxAmount),
      discountAmount: Number(l.discountAmount),
      sourceModule: l.sourceModule,
      costCenterId: l.costCenterId,
      costCenterName: l.costCenter?.name ?? null,
      processId: l.processId,
      processName: l.process?.name ?? null,
      expenseTypeId: l.expenseTypeId,
      expenseTypeCode: l.expenseType.code,
      expenseTypeName: l.expenseType.name,
      costObjectType: l.costObjectType,
      costObjectId: l.costObjectId,
      costObjectLabel: l.costObjectLabel,
    })),
  }))

  return { data: aggregateExpenseReport(mapped, lineFilters) }
}

export {
  aggregateExpenseReport as _aggregateExpenseReportForTests,
  reportWhere as _reportWhereForTests,
  lineMatchesFilters as _lineMatchesFiltersForTests,
}
