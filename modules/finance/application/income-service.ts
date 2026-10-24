import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, StorageUnavailableError, ValidationError } from "@/lib/errors"
import {
  buildObjectKey,
  createObjectStorage,
  inspectUpload,
  sha256Hex,
  type ObjectStorage,
  S3ConfigError,
} from "@/modules/storage"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { permissionCoversBranch, readBranchSharing, type BranchShareAction } from "@/shared/permissions/branch-sharing"
import { generateIncomeNo } from "./generate-income-no"

export const INCOME_STATUSES = ["DRAFT", "PENDING", "APPROVED", "RECEIVED", "REJECTED", "CANCELLED"] as const
export type IncomeStatusValue = (typeof INCOME_STATUSES)[number]

const PRICING_MODES = ["QTY_PRICE", "AMOUNT"] as const
const PAYMENT_METHODS = ["cash", "credit"] as const
export const INCOME_TAX_MODES = ["NONE", "VAT_EXCLUSIVE", "VAT_INCLUSIVE"] as const
export type IncomeTaxModeValue = (typeof INCOME_TAX_MODES)[number]
export const INCOME_VAT_RATE = 0.07
const CREATE_STATUSES = ["DRAFT", "PENDING"] as const
const EDITABLE_STATUSES: IncomeStatusValue[] = ["DRAFT", "PENDING", "REJECTED"]
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000"
const RECEIVED_LOCKED_MSG = "รายรับที่รับเงินแล้วแก้ได้เฉพาะประเภท รายละเอียด หน่วยงาน กระบวนการ และหมายเหตุ"

const moneySchema = z.number().min(0).max(999_999_999)
const qtySchema = z.number().min(0).max(9_999_999)

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const incomeLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  incomeTypeId: z.string().uuid(),
  description: z.string().max(2000).nullable().optional(),
  pricingMode: z.enum(PRICING_MODES).optional(),
  quantity: qtySchema.optional(),
  unitId: z.string().uuid().nullable().optional(),
  unitPrice: moneySchema.optional(),
  amount: moneySchema.optional(),
  taxAmount: moneySchema.optional(),
  discountAmount: moneySchema.optional(),
  costCenterId: z.string().uuid().nullable().optional(),
  processId: z.string().uuid().nullable().optional(),
})

export type IncomeLineInput = z.infer<typeof incomeLineInputSchema>

const headerShape = {
  branchId: z.string().uuid(),
  incomeDate: z.string().min(1),
  postingDate: z.string().min(1).nullable().optional(),
  payerName: z.string().trim().min(1, "ต้องระบุผู้จ่ายเงิน").max(255),
  employeeId: z.string().uuid().nullable().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  taxMode: z.enum(INCOME_TAX_MODES).optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: z.enum(CREATE_STATUSES).optional(),
}

export const createIncomeSchema = z.object({
  ...headerShape,
  lines: z.array(incomeLineInputSchema).min(1, "ต้องมีอย่างน้อย 1 บรรทัด"),
})
export const updateIncomeSchema = z
  .object({
    ...headerShape,
    lines: z.array(incomeLineInputSchema).min(1, "ต้องมีอย่างน้อย 1 บรรทัด"),
    reason: z.string().trim().min(1).max(500),
  })
  .partial()
export const receiveIncomeSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  receivedAt: z.string().min(1).nullable().optional(),
})
export const unreceiveIncomeSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>

export type IncomeAuditMeta = {
  ipAddress?: string | null
  userAgent?: string | null
}

type IncomeAuditEvent =
  | "INCOME_CREATE"
  | "INCOME_UPDATE"
  | "INCOME_APPROVE"
  | "INCOME_REJECT"
  | "INCOME_RECEIVE"
  | "INCOME_UNRECEIVE"
  | "INCOME_RECEIVED_METADATA_UPDATE"
  | "INCOME_DELETE"

type IncomeAction = "create" | "read" | "update" | "delete" | "approve"

// ─── Pure helpers ────────────────────────────────────────────────────────────

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function moneyEq(a: number, b: number): boolean {
  return round2(a) === round2(b)
}

function qtyEq(a: number, b: number): boolean {
  return Math.round(a * 1000) / 1000 === Math.round(b * 1000) / 1000
}

function sameNullable(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null)
}

function optionalUuid(value?: string | null): string | null {
  if (!value?.trim()) return null
  const parsed = z.string().uuid().safeParse(value.trim())
  return parsed.success ? parsed.data : null
}

function parseDateOnly(value: string): Date {
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return d
}

function isoDate(value: Date): string {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, "0")
  const d = String(value.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export type IncomeLineAmounts = {
  pricingMode: (typeof PRICING_MODES)[number]
  quantity: number
  unitPrice: number
  amount: number
  taxAmount: number
  discountAmount: number
  netAmount: number
}

/**
 * qty×price or entered amount, then tax by bill mode:
 * NONE: tax as entered, net = amount + tax − discount.
 * VAT_EXCLUSIVE: tax = 7% of (amount − discount), net = base + tax.
 * VAT_INCLUSIVE: base already holds the tax, tax = base × 7/107, net = base.
 * Net is floored at 0.
 */
export function computeIncomeLineAmounts(
  input: {
    pricingMode?: (typeof PRICING_MODES)[number]
    quantity?: number
    unitPrice?: number
    amount?: number
    taxAmount?: number
    discountAmount?: number
  },
  taxMode: IncomeTaxModeValue = "NONE"
): IncomeLineAmounts {
  const pricingMode = input.pricingMode ?? "AMOUNT"
  let quantity = input.quantity ?? 1
  let unitPrice = input.unitPrice ?? 0
  let amount = input.amount ?? 0
  if (pricingMode === "QTY_PRICE") {
    amount = round2(quantity * unitPrice)
  } else {
    quantity = 1
    amount = round2(amount)
    unitPrice = amount
  }
  const discountAmount = round2(input.discountAmount ?? 0)
  if (taxMode !== "NONE") {
    const base = Math.max(0, round2(amount - discountAmount))
    const taxAmount =
      taxMode === "VAT_EXCLUSIVE" ? round2(base * INCOME_VAT_RATE) : round2((base * INCOME_VAT_RATE) / (1 + INCOME_VAT_RATE))
    return {
      pricingMode,
      quantity,
      unitPrice,
      amount,
      taxAmount,
      discountAmount,
      netAmount: taxMode === "VAT_EXCLUSIVE" ? round2(base + taxAmount) : base,
    }
  }
  const taxAmount = round2(input.taxAmount ?? 0)
  const net = amount + taxAmount - discountAmount
  return {
    pricingMode,
    quantity,
    unitPrice,
    amount,
    taxAmount,
    discountAmount,
    netAmount: net < 0 ? 0 : round2(net),
  }
}

export function sumIncomeTotals(lines: Array<Pick<IncomeLineAmounts, "amount" | "taxAmount" | "discountAmount" | "netAmount">>) {
  return {
    amount: round2(lines.reduce((s, l) => s + l.amount, 0)),
    taxAmount: round2(lines.reduce((s, l) => s + l.taxAmount, 0)),
    discountAmount: round2(lines.reduce((s, l) => s + l.discountAmount, 0)),
    netAmount: round2(lines.reduce((s, l) => s + l.netAmount, 0)),
  }
}

// ─── Permission + scope ──────────────────────────────────────────────────────

function canIncomes(roles: UserRole[], action: IncomeAction): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "incomes", action))
  )
}

function shareKey(action: IncomeAction): BranchShareAction {
  return action === "update" ? "edit" : action === "read" ? "view" : action
}

async function companyWide(db: PrismaClient, companyId: string, action: IncomeAction): Promise<boolean> {
  return (await readBranchSharing(db, companyId)).finance[shareKey(action)]
}

async function assertIncomePermission(
  db: PrismaClient,
  companyId: string,
  roles: UserRole[],
  branchId: string,
  action: IncomeAction
) {
  const shared = await companyWide(db, companyId, action)
  if (!permissionCoversBranch(roles, "incomes", action, branchId, shared)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาของรายการนี้")
  }
}

async function assertBranchAllowed(
  db: PrismaClient,
  companyId: string,
  branchId: string,
  roles: UserRole[],
  shared: boolean
) {
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")
  if (!shared && !isAdminInAnyBranch(roles) && !getBranchIds(roles).includes(branchId)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
  }
}

export function incomeWhere(
  companyId: string,
  roles: UserRole[],
  branchId?: string | null,
  wide = false
): Prisma.IncomeWhereInput {
  const isAdmin = isAdminInAnyBranch(roles) || wide
  const allowed = getBranchIds(roles)
  const base: Prisma.IncomeWhereInput = { companyId, deletedAt: null }
  if (branchId) {
    if (!isAdmin && !allowed.includes(branchId)) return { id: NO_MATCH_ID }
    return { ...base, branchId }
  }
  if (!isAdmin) {
    return { ...base, branchId: { in: allowed.length ? allowed : [NO_MATCH_ID] } }
  }
  return base
}

async function writeIncomeAudit(
  db: { auditLog: { create: PrismaClient["auditLog"]["create"] } },
  params: {
    userId?: string | null
    recordId: string
    action: "create" | "update" | "delete"
    event: IncomeAuditEvent
    branchId: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    reason?: string
    audit?: IncomeAuditMeta
  }
) {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      tableName: "incomes",
      recordId: params.recordId,
      action: params.action,
      oldValues: (params.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: {
        event: params.event,
        branchId: params.branchId,
        ...(params.reason ? { reason: params.reason } : {}),
        ...(params.newValues ?? {}),
      } as Prisma.InputJsonValue,
      ipAddress: params.audit?.ipAddress ?? null,
      userAgent: params.audit?.userAgent ?? null,
    },
  })
}

// ─── Line resolution ─────────────────────────────────────────────────────────

type ResolvedLine = IncomeLineAmounts & {
  lineNo: number
  incomeTypeId: string
  description: string | null
  unitId: string | null
  unitCode: string | null
  costCenterId: string | null
  processId: string | null
}

function linePrefix(lineNo: number): string {
  return `บรรทัดที่ ${lineNo}: `
}

async function loadLineLookups(db: PrismaClient, companyId: string, lineInputs: IncomeLineInput[]) {
  const typeIds = [...new Set(lineInputs.map((l) => l.incomeTypeId))]
  const unitIds = [...new Set(lineInputs.map((l) => l.unitId).filter((id): id is string => !!id))]
  const ccIds = [...new Set(lineInputs.map((l) => l.costCenterId).filter((id): id is string => !!id))]
  const procIds = [...new Set(lineInputs.map((l) => l.processId).filter((id): id is string => !!id))]

  const [types, units, costCenters, processes] = await Promise.all([
    db.incomeType.findMany({ where: { companyId, id: { in: typeIds } }, select: { id: true } }),
    unitIds.length
      ? db.unit.findMany({ where: { companyId, id: { in: unitIds } }, select: { id: true, code: true } })
      : Promise.resolve([] as Array<{ id: string; code: string }>),
    ccIds.length
      ? db.costCenter.findMany({ where: { companyId, isActive: true, id: { in: ccIds } }, select: { id: true } })
      : Promise.resolve([] as Array<{ id: string }>),
    procIds.length
      ? db.process.findMany({ where: { companyId, isActive: true, id: { in: procIds } }, select: { id: true } })
      : Promise.resolve([] as Array<{ id: string }>),
  ])
  if (types.length !== typeIds.length) throw new ValidationError("ประเภทรายรับไม่ถูกต้อง")
  return {
    unitsById: new Map(units.map((u) => [u.id, u.code])),
    costCenterIds: new Set(costCenters.map((c) => c.id)),
    processIds: new Set(processes.map((p) => p.id)),
  }
}

async function resolveIncomeLines(
  db: PrismaClient,
  companyId: string,
  lineInputs: IncomeLineInput[],
  taxMode: IncomeTaxModeValue
): Promise<ResolvedLine[]> {
  if (lineInputs.length === 0) throw new ValidationError("ต้องมีอย่างน้อย 1 บรรทัด")
  const lookups = await loadLineLookups(db, companyId, lineInputs)
  return lineInputs.map((input, index) => {
    const lineNo = index + 1
    const amounts = computeIncomeLineAmounts(input, taxMode)
    let unitId: string | null = null
    let unitCode: string | null = null
    if (amounts.pricingMode === "QTY_PRICE") {
      if (!input.unitId) throw new ValidationError(`${linePrefix(lineNo)}ต้องเลือกหน่วย`)
      const code = lookups.unitsById.get(input.unitId)
      if (!code) throw new ValidationError(`${linePrefix(lineNo)}หน่วยไม่ถูกต้อง`)
      unitId = input.unitId
      unitCode = code
    }
    const costCenterId = input.costCenterId ?? null
    if (costCenterId && !lookups.costCenterIds.has(costCenterId)) {
      throw new ValidationError(`${linePrefix(lineNo)}หน่วยงานไม่ถูกต้อง`)
    }
    const processId = input.processId ?? null
    if (processId && !lookups.processIds.has(processId)) {
      throw new ValidationError(`${linePrefix(lineNo)}กระบวนการไม่ถูกต้อง`)
    }
    return {
      ...amounts,
      lineNo,
      incomeTypeId: input.incomeTypeId,
      description: input.description?.trim() ? input.description.trim() : null,
      unitId,
      unitCode,
      costCenterId,
      processId,
    }
  })
}

function toLineCreate(companyId: string, line: ResolvedLine): Prisma.IncomeLineCreateWithoutIncomeInput {
  return {
    companyId,
    lineNo: line.lineNo,
    incomeType: { connect: { id: line.incomeTypeId } },
    description: line.description,
    pricingMode: line.pricingMode,
    quantity: line.quantity,
    unitCode: line.unitCode,
    unitPrice: line.unitPrice,
    amount: line.amount,
    taxAmount: line.taxAmount,
    discountAmount: line.discountAmount,
    netAmount: line.netAmount,
    ...(line.costCenterId ? { costCenter: { connect: { id: line.costCenterId } } } : {}),
    ...(line.processId ? { process: { connect: { id: line.processId } } } : {}),
    ...(line.unitId ? { unit: { connect: { id: line.unitId } } } : {}),
  }
}

// ─── Serialization ───────────────────────────────────────────────────────────

const incomeInclude = {
  branch: { select: { id: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  receivedBy: { select: { id: true, firstName: true, lastName: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  lines: {
    orderBy: { lineNo: "asc" as const },
    include: {
      incomeType: { select: { id: true, code: true, name: true } },
      costCenter: { select: { id: true, name: true } },
      process: { select: { id: true, name: true } },
      unit: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.IncomeInclude

type IncomeRow = Prisma.IncomeGetPayload<{ include: typeof incomeInclude }>

function fullName(u: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!u) return null
  return `${u.firstName} ${u.lastName}`.trim()
}

export function incomeAttachmentFilePath(incomeId: string, attachmentId: string): string {
  return `/api/finance/incomes/${incomeId}/attachments/${attachmentId}/file`
}

function serializeIncome(row: IncomeRow) {
  const lines = row.lines.map((line) => ({
    id: line.id,
    lineNo: line.lineNo,
    incomeTypeId: line.incomeTypeId,
    incomeTypeCode: line.incomeType.code,
    incomeTypeName: line.incomeType.name,
    description: line.description,
    pricingMode: line.pricingMode,
    quantity: Number(line.quantity),
    unitId: line.unitId,
    unitCode: line.unitCode ?? line.unit?.code ?? null,
    unitName: line.unit?.name ?? null,
    unitPrice: Number(line.unitPrice),
    amount: Number(line.amount),
    taxAmount: Number(line.taxAmount),
    discountAmount: Number(line.discountAmount),
    netAmount: Number(line.netAmount),
    costCenterId: line.costCenterId,
    costCenterName: line.costCenter?.name ?? null,
    processId: line.processId,
    processName: line.process?.name ?? null,
  }))
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    branchName: row.branch.name,
    incomeNo: row.incomeNo,
    incomeDate: isoDate(row.incomeDate),
    postingDate: row.postingDate ? isoDate(row.postingDate) : isoDate(row.incomeDate),
    payerName: row.payerName,
    employeeId: row.employeeId,
    employeeName: fullName(row.employee),
    amount: Number(row.amount),
    taxAmount: Number(row.taxAmount),
    discountAmount: Number(row.discountAmount),
    netAmount: Number(row.netAmount),
    currency: row.currency,
    notes: row.notes,
    status: row.status,
    paymentMethod: row.paymentMethod,
    taxMode: row.taxMode,
    receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    receivedById: row.receivedById,
    receivedByName: fullName(row.receivedBy),
    approvedById: row.approvedById,
    approvedByName: fullName(row.approvedBy),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdById: row.createdById,
    createdByName: fullName(row.creator),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      fileUrl: a.storedFileId ? incomeAttachmentFilePath(row.id, a.id) : a.fileUrl,
      fileName: a.fileName,
      fileSize: a.fileSize,
      storedFileId: a.storedFileId,
    })),
    lines,
    lineCount: lines.length,
  }
}

export type IncomeDto = ReturnType<typeof serializeIncome>
export type IncomeLineDto = IncomeDto["lines"][number]

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listIncomes(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    incomeTypeId?: string | null
    costCenterId?: string | null
    processId?: string | null
    status?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    search?: string | null
  }
) {
  if (!canIncomes(params.roles, "read")) throw new ForbiddenError()
  const where = incomeWhere(
    params.companyId,
    params.roles,
    params.branchId,
    await companyWide(db, params.companyId, "read")
  )
  const and: Prisma.IncomeWhereInput[] = []

  const incomeTypeId = optionalUuid(params.incomeTypeId)
  if (incomeTypeId) and.push({ lines: { some: { incomeTypeId } } })
  const costCenterRaw = params.costCenterId?.trim()
  if (costCenterRaw === "none") {
    and.push({ lines: { some: { costCenterId: null } } })
  } else {
    const costCenterId = optionalUuid(costCenterRaw)
    if (costCenterId) and.push({ lines: { some: { costCenterId } } })
  }
  const processRaw = params.processId?.trim()
  if (processRaw === "none") {
    and.push({ lines: { some: { processId: null } } })
  } else {
    const processId = optionalUuid(processRaw)
    if (processId) and.push({ lines: { some: { processId } } })
  }
  if (params.status && (INCOME_STATUSES as readonly string[]).includes(params.status)) {
    where.status = params.status as IncomeStatusValue
  }
  if (params.dateFrom?.trim() || params.dateTo?.trim()) {
    const range: Prisma.DateTimeFilter = {}
    if (params.dateFrom?.trim()) range.gte = parseDateOnly(params.dateFrom.trim())
    if (params.dateTo?.trim()) range.lte = parseDateOnly(params.dateTo.trim())
    where.incomeDate = range
  }
  if (params.search?.trim()) {
    const q = params.search.trim()
    where.OR = [
      { incomeNo: { contains: q, mode: "insensitive" } },
      { payerName: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { lines: { some: { description: { contains: q, mode: "insensitive" } } } },
    ]
  }
  if (and.length) where.AND = and

  const rows = await db.income.findMany({
    where,
    include: incomeInclude,
    orderBy: [{ incomeDate: "desc" }, { createdAt: "desc" }],
    take: 300,
  })
  return { data: rows.map(serializeIncome) }
}

export async function getIncome(db: PrismaClient, params: { companyId: string; roles: UserRole[]; id: string }) {
  if (!canIncomes(params.roles, "read")) throw new ForbiddenError()
  const row = await db.income.findFirst({
    where: {
      id: params.id,
      ...incomeWhere(params.companyId, params.roles, null, await companyWide(db, params.companyId, "read")),
    },
    include: incomeInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบรายการรายรับ")
  return { data: serializeIncome(row) }
}

export async function getIncomeSummary(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    dateFrom?: string | null
    dateTo?: string | null
  }
) {
  if (!canIncomes(params.roles, "read")) throw new ForbiddenError()
  const where = incomeWhere(
    params.companyId,
    params.roles,
    params.branchId,
    await companyWide(db, params.companyId, "read")
  )
  if (params.dateFrom?.trim() || params.dateTo?.trim()) {
    const range: Prisma.DateTimeFilter = {}
    if (params.dateFrom?.trim()) range.gte = parseDateOnly(params.dateFrom.trim())
    if (params.dateTo?.trim()) range.lte = parseDateOnly(params.dateTo.trim())
    where.incomeDate = range
  }
  const rows = await db.income.findMany({
    where,
    select: { status: true, netAmount: true },
    take: 5000,
  })
  const counts = Object.fromEntries(INCOME_STATUSES.map((s) => [s, 0])) as Record<IncomeStatusValue, number>
  const totals = Object.fromEntries(INCOME_STATUSES.map((s) => [s, 0])) as Record<IncomeStatusValue, number>
  for (const r of rows) {
    counts[r.status] += 1
    totals[r.status] = round2(totals[r.status] + Number(r.netAmount))
  }
  return { counts, totals }
}

export async function listIncomeFormOptions(db: PrismaClient, params: { companyId: string; roles: UserRole[] }) {
  if (!canIncomes(params.roles, "read")) throw new ForbiddenError()
  const share = await readBranchSharing(db, params.companyId)
  const wide = isAdminInAnyBranch(params.roles) || share.finance.view || share.finance.create || share.finance.edit
  const allowed = getBranchIds(params.roles)
  const [branches, users] = await Promise.all([
    db.branch.findMany({
      where: {
        companyId: params.companyId,
        deletedAt: null,
        isActive: true,
        ...(wide ? {} : { id: { in: allowed.length ? allowed : [NO_MATCH_ID] } }),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { companyId: params.companyId, deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 500,
    }),
  ])
  return {
    data: {
      branches,
      employees: users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })),
    },
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

async function findScopedIncome<S extends Prisma.IncomeSelect>(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string },
  action: IncomeAction,
  select: S
) {
  const row = await db.income.findFirst({
    where: {
      id: params.id,
      ...incomeWhere(params.companyId, params.roles, null, await companyWide(db, params.companyId, action)),
    },
    select,
  })
  if (!row) throw new NotFoundError("ไม่พบรายการรายรับ")
  return row as Prisma.IncomeGetPayload<{ select: S }>
}

export async function createIncome(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    input: CreateIncomeInput
    audit?: IncomeAuditMeta
  }
) {
  const { input } = params
  await assertIncomePermission(db, params.companyId, params.roles, input.branchId, "create")
  await assertBranchAllowed(
    db,
    params.companyId,
    input.branchId,
    params.roles,
    await companyWide(db, params.companyId, "create")
  )
  const taxMode = input.taxMode ?? "NONE"
  const lines = await resolveIncomeLines(db, params.companyId, input.lines, taxMode)
  const totals = sumIncomeTotals(lines)

  let row: IncomeRow | null = null
  for (let attempt = 0; attempt < 3 && !row; attempt += 1) {
    const incomeNo = await generateIncomeNo(db, params.companyId)
    try {
      row = await db.income.create({
        data: {
          companyId: params.companyId,
          branchId: input.branchId,
          incomeNo,
          incomeDate: parseDateOnly(input.incomeDate),
          postingDate: parseDateOnly(input.postingDate || input.incomeDate),
          payerName: input.payerName.trim(),
          employeeId: input.employeeId ?? null,
          ...totals,
          paymentMethod: input.paymentMethod ?? null,
          taxMode,
          notes: input.notes ?? null,
          status: input.status ?? "DRAFT",
          createdById: params.userId,
          lines: { create: lines.map((l) => toLineCreate(params.companyId, l)) },
        },
        include: incomeInclude,
      })
    } catch (err) {
      const retry = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
      if (!retry || attempt === 2) throw err
    }
  }
  if (!row) throw new ValidationError("สร้างเลขที่เอกสารไม่สำเร็จ")

  await writeIncomeAudit(db, {
    userId: params.userId,
    recordId: row.id,
    action: "create",
    event: "INCOME_CREATE",
    branchId: row.branchId,
    newValues: { incomeNo: row.incomeNo, status: row.status, netAmount: Number(row.netAmount) },
    audit: params.audit,
  })
  return { data: serializeIncome(row) }
}

export async function updateIncome(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string
    id: string
    input: UpdateIncomeInput
    audit?: IncomeAuditMeta
  }
) {
  const existing = await findScopedIncome(db, params, "update", {
    id: true,
    status: true,
    branchId: true,
    taxMode: true,
  })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, "update")
  if (existing.status === "RECEIVED") return updateReceivedIncomeMetadata(db, params)
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new ValidationError("แก้ไขได้เฉพาะรายการที่ยังไม่อนุมัติ")
  }
  const { input } = params
  const taxMode = input.taxMode ?? existing.taxMode
  if (taxMode !== existing.taxMode && !input.lines) {
    throw new ValidationError("เปลี่ยนสถานะภาษีต้องส่งบรรทัดรายการมาพร้อมกัน")
  }
  if (input.branchId) {
    await assertBranchAllowed(
      db,
      params.companyId,
      input.branchId,
      params.roles,
      await companyWide(db, params.companyId, "update")
    )
  }

  const headerData: Prisma.IncomeUpdateInput = {
    ...(input.branchId ? { branch: { connect: { id: input.branchId } } } : {}),
    ...(input.incomeDate ? { incomeDate: parseDateOnly(input.incomeDate) } : {}),
    ...(input.postingDate !== undefined
      ? { postingDate: input.postingDate ? parseDateOnly(input.postingDate) : null }
      : {}),
    ...(input.payerName !== undefined ? { payerName: input.payerName.trim() } : {}),
    ...(input.employeeId !== undefined
      ? input.employeeId
        ? { employee: { connect: { id: input.employeeId } } }
        : { employee: { disconnect: true } }
      : {}),
    ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.taxMode !== undefined ? { taxMode: input.taxMode } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.status ? { status: input.status } : {}),
  }

  if (input.lines) {
    const lines = await resolveIncomeLines(db, params.companyId, input.lines, taxMode)
    const totals = sumIncomeTotals(lines)
    await db.$transaction(async (tx) => {
      await tx.incomeLine.deleteMany({ where: { incomeId: params.id } })
      await tx.income.update({
        where: { id: params.id },
        data: {
          ...headerData,
          ...totals,
          lines: { create: lines.map((l) => toLineCreate(params.companyId, l)) },
        },
      })
    })
  } else {
    await db.income.update({ where: { id: params.id }, data: headerData })
  }

  const row = await db.income.findFirst({ where: { id: params.id }, include: incomeInclude })
  if (!row) throw new NotFoundError("ไม่พบรายการรายรับ")
  await writeIncomeAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "INCOME_UPDATE",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: row.status, netAmount: Number(row.netAmount) },
    audit: params.audit,
  })
  return { data: serializeIncome(row) }
}

function receivedLineFinancialsChanged(
  row: {
    pricingMode: string
    quantity: unknown
    unitPrice: unknown
    amount: unknown
    taxAmount: unknown
    discountAmount: unknown
    unitId: string | null
  },
  input: IncomeLineInput
): boolean {
  if (input.pricingMode && input.pricingMode !== row.pricingMode) return true
  if (row.pricingMode === "QTY_PRICE") {
    if (input.quantity != null && !qtyEq(input.quantity, Number(row.quantity))) return true
    if (input.unitPrice != null && !moneyEq(input.unitPrice, Number(row.unitPrice))) return true
    if (input.unitId !== undefined && !sameNullable(input.unitId, row.unitId)) return true
  } else if (input.amount != null && !moneyEq(input.amount, Number(row.amount))) {
    return true
  }
  if (input.taxAmount != null && !moneyEq(input.taxAmount, Number(row.taxAmount))) return true
  if (input.discountAmount != null && !moneyEq(input.discountAmount, Number(row.discountAmount))) return true
  return false
}

/** RECEIVED: amounts and header money fields stay locked; type, description, cost center, process, notes may change with a reason. */
export async function updateReceivedIncomeMetadata(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string
    id: string
    input: UpdateIncomeInput
    audit?: IncomeAuditMeta
  }
) {
  const existing = await findScopedIncome(db, params, "update", {
    id: true,
    status: true,
    branchId: true,
    incomeDate: true,
    postingDate: true,
    payerName: true,
    employeeId: true,
    paymentMethod: true,
    taxMode: true,
    notes: true,
    lines: {
      orderBy: { lineNo: "asc" },
      select: {
        id: true,
        lineNo: true,
        incomeTypeId: true,
        description: true,
        pricingMode: true,
        quantity: true,
        unitId: true,
        unitPrice: true,
        amount: true,
        taxAmount: true,
        discountAmount: true,
        costCenterId: true,
        processId: true,
      },
    },
  })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, "update")
  if (existing.status !== "RECEIVED") throw new ValidationError("ใช้ได้เฉพาะรายการที่รับเงินแล้ว")

  const { input } = params
  const reason = input.reason?.trim()
  if (!reason) throw new ValidationError("กรุณาระบุเหตุผลในการแก้ไขรายการที่รับเงินแล้ว")

  if (input.branchId && input.branchId !== existing.branchId) throw new ValidationError(RECEIVED_LOCKED_MSG)
  if (input.status !== undefined) throw new ValidationError(RECEIVED_LOCKED_MSG)
  if (input.incomeDate && input.incomeDate.slice(0, 10) !== isoDate(existing.incomeDate)) {
    throw new ValidationError(RECEIVED_LOCKED_MSG)
  }
  if (input.postingDate !== undefined) {
    const next = input.postingDate ? input.postingDate.slice(0, 10) : null
    const prev = existing.postingDate ? isoDate(existing.postingDate) : null
    if (next !== prev) throw new ValidationError(RECEIVED_LOCKED_MSG)
  }
  if (input.payerName !== undefined && input.payerName.trim() !== existing.payerName) {
    throw new ValidationError(RECEIVED_LOCKED_MSG)
  }
  if (input.employeeId !== undefined && !sameNullable(input.employeeId, existing.employeeId)) {
    throw new ValidationError(RECEIVED_LOCKED_MSG)
  }
  if (input.paymentMethod !== undefined && !sameNullable(input.paymentMethod, existing.paymentMethod)) {
    throw new ValidationError(RECEIVED_LOCKED_MSG)
  }
  if (input.taxMode !== undefined && input.taxMode !== existing.taxMode) {
    throw new ValidationError(RECEIVED_LOCKED_MSG)
  }
  const computedTax = existing.taxMode !== "NONE"

  type LinePatch = {
    id: string
    incomeTypeId: string
    description: string | null
    costCenterId: string | null
    processId: string | null
  }
  const patches: LinePatch[] = []
  if (input.lines) {
    if (input.lines.length !== existing.lines.length) {
      throw new ValidationError("ไม่สามารถเพิ่มหรือลบบรรทัดของรายการที่รับเงินแล้ว")
    }
    const byId = new Map(existing.lines.map((l) => [l.id, l]))
    const seen = new Set<string>()
    for (const line of input.lines) {
      const row = line.id ? byId.get(line.id) : undefined
      if (!row || seen.has(row.id)) throw new ValidationError("บรรทัดไม่ตรงกับรายการเดิม")
      seen.add(row.id)
      const comparable = computedTax ? { ...line, taxAmount: undefined } : line
      if (receivedLineFinancialsChanged(row, comparable)) throw new ValidationError(RECEIVED_LOCKED_MSG)
    }
    const lookups = await loadLineLookups(db, params.companyId, input.lines)
    for (const line of input.lines) {
      const row = byId.get(line.id as string)!
      const costCenterId = line.costCenterId !== undefined ? (line.costCenterId ?? null) : row.costCenterId
      const processId = line.processId !== undefined ? (line.processId ?? null) : row.processId
      if (costCenterId && costCenterId !== row.costCenterId && !lookups.costCenterIds.has(costCenterId)) {
        throw new ValidationError(`${linePrefix(row.lineNo)}หน่วยงานไม่ถูกต้อง`)
      }
      if (processId && processId !== row.processId && !lookups.processIds.has(processId)) {
        throw new ValidationError(`${linePrefix(row.lineNo)}กระบวนการไม่ถูกต้อง`)
      }
      patches.push({
        id: row.id,
        incomeTypeId: line.incomeTypeId,
        description:
          line.description !== undefined ? (line.description?.trim() ? line.description.trim() : null) : row.description,
        costCenterId,
        processId,
      })
    }
  }

  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  if (input.notes !== undefined && !sameNullable(input.notes, existing.notes)) {
    oldValues.notes = existing.notes
    newValues.notes = input.notes
  }
  const prevLines = existing.lines.map((l) => ({
    id: l.id,
    incomeTypeId: l.incomeTypeId,
    description: l.description,
    costCenterId: l.costCenterId,
    processId: l.processId,
  }))
  if (patches.length && JSON.stringify(prevLines) !== JSON.stringify(patches)) {
    oldValues.lines = prevLines
    newValues.lines = patches
  }

  await db.$transaction(async (tx) => {
    for (const patch of patches) {
      await tx.incomeLine.update({
        where: { id: patch.id },
        data: {
          incomeType: { connect: { id: patch.incomeTypeId } },
          description: patch.description,
          costCenter: patch.costCenterId ? { connect: { id: patch.costCenterId } } : { disconnect: true },
          process: patch.processId ? { connect: { id: patch.processId } } : { disconnect: true },
        },
      })
    }
    if (input.notes !== undefined) {
      await tx.income.update({ where: { id: params.id }, data: { notes: input.notes } })
    }
    if (Object.keys(newValues).length > 0) {
      await writeIncomeAudit(tx, {
        userId: params.userId,
        recordId: params.id,
        action: "update",
        event: "INCOME_RECEIVED_METADATA_UPDATE",
        branchId: existing.branchId,
        reason,
        oldValues,
        newValues,
        audit: params.audit,
      })
    }
  })

  const row = await db.income.findFirst({ where: { id: params.id }, include: incomeInclude })
  if (!row) throw new NotFoundError("ไม่พบรายการรายรับ")
  return { data: serializeIncome(row) }
}

type TransitionParams = {
  companyId: string
  roles: UserRole[]
  userId: string
  id: string
  audit?: IncomeAuditMeta
}

export async function approveIncome(db: PrismaClient, params: TransitionParams) {
  const existing = await findScopedIncome(db, params, "approve", { id: true, status: true, branchId: true })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, "approve")
  if (existing.status !== "DRAFT" && existing.status !== "PENDING") {
    throw new ValidationError("อนุมัติได้เฉพาะรายการที่รอดำเนินการ")
  }
  const row = await db.income.update({
    where: { id: params.id },
    data: { status: "APPROVED", approvedById: params.userId, approvedAt: new Date() },
    include: incomeInclude,
  })
  await writeIncomeAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "INCOME_APPROVE",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: "APPROVED" },
    audit: params.audit,
  })
  return { data: serializeIncome(row) }
}

export async function rejectIncome(db: PrismaClient, params: TransitionParams) {
  const existing = await findScopedIncome(db, params, "approve", { id: true, status: true, branchId: true })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, "approve")
  if (existing.status !== "DRAFT" && existing.status !== "PENDING") {
    throw new ValidationError("ปฏิเสธได้เฉพาะรายการที่รอดำเนินการ")
  }
  const row = await db.income.update({
    where: { id: params.id },
    data: { status: "REJECTED", approvedById: params.userId, approvedAt: new Date() },
    include: incomeInclude,
  })
  await writeIncomeAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "INCOME_REJECT",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: "REJECTED" },
    audit: params.audit,
  })
  return { data: serializeIncome(row) }
}

export async function markIncomeReceived(
  db: PrismaClient,
  params: TransitionParams & { input?: z.infer<typeof receiveIncomeSchema> }
) {
  const existing = await findScopedIncome(db, params, "update", { id: true, status: true, branchId: true })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, "update")
  if (existing.status !== "APPROVED") {
    throw new ValidationError("บันทึกรับเงินได้เฉพาะรายการที่อนุมัติแล้ว")
  }
  const receivedAt = params.input?.receivedAt ? parseDateOnly(params.input.receivedAt) : new Date()
  const row = await db.income.update({
    where: { id: params.id },
    data: {
      status: "RECEIVED",
      receivedById: params.userId,
      receivedAt,
      ...(params.input?.paymentMethod !== undefined ? { paymentMethod: params.input.paymentMethod } : {}),
    },
    include: incomeInclude,
  })
  await writeIncomeAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "INCOME_RECEIVE",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: "RECEIVED" },
    audit: params.audit,
  })
  return { data: serializeIncome(row) }
}

export async function unreceiveIncome(
  db: PrismaClient,
  params: TransitionParams & { input: { reason?: string | null } }
) {
  const existing = await findScopedIncome(db, params, "update", {
    id: true,
    status: true,
    branchId: true,
    receivedAt: true,
    receivedById: true,
  })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, "update")
  if (existing.status !== "RECEIVED") {
    throw new ValidationError("ยกเลิกการรับเงินได้เฉพาะรายการที่รับเงินแล้ว")
  }
  const reason = typeof params.input?.reason === "string" ? params.input.reason.trim() : ""
  if (!reason) throw new ValidationError("กรุณาระบุเหตุผลในการยกเลิกการรับเงิน")
  if (reason.length > 500) throw new ValidationError("เหตุผลยาวเกินไป")

  const row = await db.income.update({
    where: { id: params.id },
    data: { status: "APPROVED", receivedAt: null, receivedBy: { disconnect: true } },
    include: incomeInclude,
  })
  await writeIncomeAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "INCOME_UNRECEIVE",
    branchId: existing.branchId,
    reason,
    oldValues: {
      status: existing.status,
      receivedAt: existing.receivedAt ? existing.receivedAt.toISOString() : null,
      receivedById: existing.receivedById,
    },
    newValues: { status: "APPROVED", receivedAt: null, receivedById: null },
    audit: params.audit,
  })
  return { data: serializeIncome(row) }
}

export async function deleteIncome(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId?: string; id: string; audit?: IncomeAuditMeta }
) {
  const existing = await findScopedIncome(db, params, "delete", { id: true, status: true, branchId: true })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, "delete")
  if (existing.status === "RECEIVED") {
    throw new ValidationError("ไม่สามารถลบรายการที่รับเงินแล้ว ให้ยกเลิกการรับเงินก่อน")
  }
  await db.income.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  })
  await writeIncomeAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "delete",
    event: "INCOME_DELETE",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: "CANCELLED" },
    audit: params.audit,
  })
  return { data: { id: params.id } }
}

// ─── Attachments ─────────────────────────────────────────────────────────────

function resolveObjectStorage(storage?: ObjectStorage): ObjectStorage {
  if (storage) return storage
  try {
    return createObjectStorage()
  } catch (err) {
    if (err instanceof S3ConfigError) console.error(err.message)
    else console.error("s3 config invalid")
    throw new StorageUnavailableError()
  }
}

async function loadIncomeForFile(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string },
  action: "read" | "update"
) {
  const existing = await findScopedIncome(db, params, action, { id: true, status: true, branchId: true })
  await assertIncomePermission(db, params.companyId, params.roles, existing.branchId, action)
  return existing
}

export async function uploadIncomeFile(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    originalName: string
    body: Buffer
    storage?: ObjectStorage
  }
) {
  const existing = await loadIncomeForFile(db, params, "update")
  if (existing.status === "CANCELLED") throw new ValidationError("ไม่สามารถแนบไฟล์กับรายการที่ยกเลิกแล้ว")
  const storage = resolveObjectStorage(params.storage)
  const inspected = inspectUpload(params.body, params.originalName, storage.maxUploadBytes)
  const { fileId, objectKey } = buildObjectKey({ module: "finance", entityType: "income", recordId: existing.id })
  const checksum = sha256Hex(params.body)
  await storage.putObject({ key: objectKey, body: params.body, contentType: inspected.contentType })
  try {
    const row = await db.$transaction(async (tx) => {
      await tx.storedFile.create({
        data: {
          id: fileId,
          companyId: params.companyId,
          branchId: existing.branchId,
          bucket: storage.bucket,
          objectKey,
          originalName: inspected.originalName,
          contentType: inspected.contentType,
          sizeBytes: params.body.length,
          sha256: checksum,
          module: "finance",
          entityType: "income",
          entityId: existing.id,
          uploadedById: params.userId,
        },
      })
      const created = await tx.incomeAttachment.create({
        data: {
          incomeId: existing.id,
          fileUrl: "pending",
          fileName: inspected.originalName,
          fileSize: params.body.length,
          uploadedBy: params.userId,
          storedFileId: fileId,
        },
      })
      const updated = await tx.incomeAttachment.update({
        where: { id: created.id },
        data: { fileUrl: incomeAttachmentFilePath(existing.id, created.id) },
      })
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          tableName: "income_attachments",
          recordId: updated.id,
          action: "create",
          newValues: {
            incomeId: existing.id,
            fileName: updated.fileName,
            fileSize: updated.fileSize,
            storedFileId: fileId,
          },
        },
      })
      return updated
    })
    return {
      data: {
        id: row.id,
        fileUrl: row.fileUrl,
        fileName: row.fileName,
        fileSize: row.fileSize,
        storedFileId: row.storedFileId,
      },
    }
  } catch (err) {
    try {
      await storage.deleteObject(objectKey)
    } catch {
      console.error("stored file cleanup failed", { fileId, incomeId: existing.id, module: "finance" })
    }
    throw err
  }
}

export async function readIncomeAttachmentFile(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    id: string
    attachmentId: string
    storage?: ObjectStorage
  }
) {
  const existing = await loadIncomeForFile(db, params, "read")
  const attachment = await db.incomeAttachment.findFirst({
    where: { id: params.attachmentId, incomeId: existing.id },
    include: { storedFile: true },
  })
  const stored = attachment?.storedFile
  if (
    !stored ||
    stored.deletedAt ||
    stored.companyId !== params.companyId ||
    stored.entityId !== existing.id ||
    stored.module !== "finance" ||
    stored.entityType !== "income"
  ) {
    throw new NotFoundError("ไม่พบไฟล์")
  }
  const storage = resolveObjectStorage(params.storage)
  const bytes = await storage.getObject(stored.objectKey)
  if (sha256Hex(bytes) !== stored.sha256.trim()) {
    console.error("stored file checksum mismatch", { fileId: stored.id, module: "finance" })
    throw new StorageUnavailableError()
  }
  return {
    bytes,
    contentType: stored.contentType,
    originalName: stored.originalName,
    sizeBytes: stored.sizeBytes,
  }
}

export async function removeIncomeAttachment(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; userId: string; id: string; attachmentId: string }
) {
  const existing = await loadIncomeForFile(db, params, "update")
  if (existing.status === "CANCELLED") throw new ValidationError("ไม่สามารถลบไฟล์ของรายการที่ยกเลิกแล้ว")
  const attachment = await db.incomeAttachment.findFirst({
    where: { id: params.attachmentId, incomeId: existing.id },
    select: { id: true, fileName: true, storedFileId: true },
  })
  if (!attachment) throw new NotFoundError("ไม่พบไฟล์")
  await db.$transaction(async (tx) => {
    await tx.incomeAttachment.delete({ where: { id: attachment.id } })
    if (attachment.storedFileId) {
      await tx.storedFile.update({ where: { id: attachment.storedFileId }, data: { deletedAt: new Date() } })
    }
    await tx.auditLog.create({
      data: {
        userId: params.userId,
        tableName: "income_attachments",
        recordId: attachment.id,
        action: "delete",
        oldValues: { incomeId: existing.id, fileName: attachment.fileName },
      },
    })
  })
  return { data: { id: attachment.id } }
}
