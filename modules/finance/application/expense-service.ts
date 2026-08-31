import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { generateExpenseNo } from "./generate-expense-no"
import { getTransportCostSourcesByIds, isLockedReferenceAmount } from "@/modules/transport"
import {
  assertSourceLinesNotLinked,
  markReviewsExpenseCreated,
  reopenReviewsOnExpenseCancel,
  resolveTransportSources,
  type SourceIdentity,
} from "./expense-source-service"

export const EXPENSE_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "PAID",
  "REJECTED",
  "CANCELLED",
] as const
export type ExpenseStatusValue = (typeof EXPENSE_STATUSES)[number]

// Modules that can be a source of expense lines. Manual bills carry no module
// (sourceKind = MANUAL, sourceModule = null); do not add MANUAL/OTHER here.
export const EXPENSE_SOURCE_MODULES = ["TRANSPORT", "MAINTENANCE", "INVENTORY", "HR"] as const

export const EXPENSE_SOURCE_KINDS = ["MANUAL", "MODULE", "IMPORT"] as const

export const EXPENSE_PRICING_MODES = ["QTY_PRICE", "AMOUNT"] as const

export const EXPENSE_COST_OBJECT_TYPES = [
  "VEHICLE",
  "MACHINE",
  "TIRE",
  "JOB",
  "CUSTOMER",
  "PRODUCT",
  "PROJECT",
  "LOCATION",
  "OTHER",
] as const

const PAYMENT_METHODS = ["cash", "credit"] as const
const CREATE_STATUSES = ["DRAFT", "PENDING"] as const

const moneySchema = z.number().min(0).max(999_999_999)
const qtySchema = z.number().min(0).max(9_999_999)

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const expenseLineInputSchema = z.object({
  id: z.string().uuid().optional(),
  expenseTypeId: z.string().uuid(),
  description: z.string().max(2000).nullable().optional(),
  pricingMode: z.enum(EXPENSE_PRICING_MODES).optional(),
  quantity: qtySchema.optional(),
  unitId: z.string().uuid().nullable().optional(),
  unitCode: z.string().max(30).nullable().optional(),
  unitPrice: moneySchema.optional(),
  amount: moneySchema.optional(),
  taxAmount: moneySchema.optional(),
  discountAmount: moneySchema.optional(),
  costCenterId: z.string().uuid().nullable().optional(),
  processId: z.string().uuid().nullable().optional(),
  costObjectType: z.enum(EXPENSE_COST_OBJECT_TYPES).nullable().optional(),
  costObjectId: z.string().max(64).nullable().optional(),
  costObjectLabel: z.string().max(255).nullable().optional(),
  sourceKind: z.enum(EXPENSE_SOURCE_KINDS).optional(),
  sourceModule: z.enum(EXPENSE_SOURCE_MODULES).nullable().optional(),
  sourceType: z.string().max(50).nullable().optional(),
  sourceDocumentId: z.string().max(64).nullable().optional(),
  sourceLineId: z.string().max(64).nullable().optional(),
})

export type ExpenseLineInput = z.infer<typeof expenseLineInputSchema>

const headerShape = {
  branchId: z.string().uuid(),
  expenseDate: z.string().min(1),
  postingDate: z.string().min(1).nullable().optional(),
  vendorId: z.string().uuid().nullable().optional(),
  employeeId: z.string().uuid().nullable().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: z.enum(CREATE_STATUSES).optional(),
  lines: z.array(expenseLineInputSchema).optional(),
}

// Legacy flat fields kept so older clients that post a single expense without a
// `lines` array keep working; they are wrapped into one line server-side.
const legacyFlatShape = {
  expenseTypeId: z.string().uuid().optional(),
  amount: moneySchema.optional(),
  taxAmount: moneySchema.optional(),
  discountAmount: moneySchema.optional(),
  sourceModule: z.string().optional(),
  sourceType: z.string().max(50).nullable().optional(),
  sourceId: z.string().max(64).nullable().optional(),
  costCenterId: z.string().uuid().nullable().optional(),
  costObjectType: z.enum(EXPENSE_COST_OBJECT_TYPES).nullable().optional(),
  costObjectId: z.string().max(64).nullable().optional(),
  costObjectLabel: z.string().max(255).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
}

export const createExpenseSchema = z.object({ ...headerShape, ...legacyFlatShape })
export const updateExpenseSchema = z
  .object({
    ...headerShape,
    ...legacyFlatShape,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .partial()
export const payExpenseSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  paidAt: z.string().min(1).nullable().optional(),
})
export const unpayExpenseSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

export const expenseAttachmentInputSchema = z.object({
  fileUrl: z.string().min(1).max(2000),
  fileName: z.string().max(255).nullable().optional(),
  fileSize: z.number().int().min(0).max(20 * 1024 * 1024).nullable().optional(),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>

export type ExpenseAuditMeta = {
  ipAddress?: string | null
  userAgent?: string | null
}

type ExpenseAuditEvent =
  | "EXPENSE_CREATE"
  | "EXPENSE_UPDATE"
  | "EXPENSE_APPROVE"
  | "EXPENSE_REJECT"
  | "EXPENSE_PAY"
  | "EXPENSE_UNPAY"
  | "EXPENSE_PAID_METADATA_UPDATE"

type ExpenseAction = "create" | "read" | "update" | "delete" | "approve"

function canExpenses(roles: UserRole[], action: ExpenseAction): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "expenses", action))
  )
}

function assertExpensePermission(roles: UserRole[], branchId: string, action: ExpenseAction) {
  if (!hasPermission(roles, branchId, "expenses", action)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาของรายการนี้")
  }
}

async function writeExpenseAudit(
  db: { auditLog: { create: PrismaClient["auditLog"]["create"] } },
  params: {
    userId?: string | null
    recordId: string
    action: "create" | "update" | "delete"
    event: ExpenseAuditEvent
    branchId: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    reason?: string
    audit?: ExpenseAuditMeta
  }
) {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      tableName: "expenses",
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

function optionalUuid(value?: string | null): string | null {
  if (!value?.trim()) return null
  const parsed = z.string().uuid().safeParse(value.trim())
  return parsed.success ? parsed.data : null
}

function parseDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return d
}

function isoDate(value: Date): string {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, "0")
  const d = String(value.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** YYYY-MM from a date-only string (`YYYY-MM-DD`) or Date stored as UTC midnight. */
export function bangkokYearMonth(value: string | Date): string {
  if (value instanceof Date) return isoDate(value).slice(0, 7)
  const ymd = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return ymd.slice(0, 7)
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

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function computeNet(amount: number, tax: number, discount: number): number {
  const net = amount + tax - discount
  return net < 0 ? 0 : round2(net)
}

function isSourceModule(value: unknown): value is (typeof EXPENSE_SOURCE_MODULES)[number] {
  return typeof value === "string" && (EXPENSE_SOURCE_MODULES as readonly string[]).includes(value)
}

async function assertBranchAllowed(
  db: PrismaClient,
  companyId: string,
  branchId: string,
  roles: UserRole[]
) {
  const branch = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!branch) throw new ValidationError("สาขาไม่ถูกต้อง")
  if (!isAdminInAnyBranch(roles) && !getBranchIds(roles).includes(branchId)) {
    throw new ForbiddenError("ไม่มีสิทธิ์ในสาขาที่เลือก")
  }
}

// ─── Line normalization + resolution ─────────────────────────────────────────

/** Convert create/update input (with lines[] or a legacy flat body) to line inputs. */
function coerceLineInputs(input: CreateExpenseInput | UpdateExpenseInput): ExpenseLineInput[] | null {
  if (input.lines && input.lines.length > 0) return input.lines
  if (input.amount != null && input.expenseTypeId) {
    const isModule = isSourceModule(input.sourceModule)
    return [
      {
        expenseTypeId: input.expenseTypeId,
        description: input.description ?? null,
        pricingMode: "AMOUNT",
        quantity: 1,
        unitPrice: input.amount,
        amount: input.amount,
        taxAmount: input.taxAmount ?? 0,
        discountAmount: input.discountAmount ?? 0,
        costCenterId: input.costCenterId ?? null,
        processId: null,
        unitId: null,
        costObjectType: input.costObjectType ?? null,
        costObjectId: input.costObjectId ?? null,
        costObjectLabel: input.costObjectLabel ?? null,
        sourceKind: isModule ? "IMPORT" : "MANUAL",
        sourceModule: isModule ? (input.sourceModule as (typeof EXPENSE_SOURCE_MODULES)[number]) : null,
        sourceType: isModule ? input.sourceType ?? null : null,
        sourceDocumentId: isModule ? input.sourceId ?? null : null,
        sourceLineId: null,
      },
    ]
  }
  return null
}

type ResolvedLine = {
  lineNo: number
  expenseTypeId: string
  description: string | null
  pricingMode: (typeof EXPENSE_PRICING_MODES)[number]
  quantity: number
  unitId: string | null
  unitCode: string | null
  unitPrice: number
  amount: number
  taxAmount: number
  discountAmount: number
  netAmount: number
  costCenterId: string | null
  processId: string | null
  costObjectType: (typeof EXPENSE_COST_OBJECT_TYPES)[number] | null
  costObjectId: string | null
  costObjectLabel: string | null
  sourceKind: (typeof EXPENSE_SOURCE_KINDS)[number]
  sourceModule: (typeof EXPENSE_SOURCE_MODULES)[number] | null
  sourceType: string | null
  sourceDocumentId: string | null
  sourceLineId: string | null
}

type ResolvedBill = {
  lines: ResolvedLine[]
  primaryTypeId: string
  derivedModule: (typeof EXPENSE_SOURCE_MODULES)[number] | null
  amount: number
  taxAmount: number
  discountAmount: number
  netAmount: number
  identities: SourceIdentity[]
}

export type TypeDimensionMeta = {
  id: string
  requiresVendor: boolean
  requiresVehicle: boolean
  requiresMachine: boolean
  requiresLocation: boolean
  requiresCostCenter: boolean
  requiresProcess: boolean
  allowedCostCenterIds: string[]
  defaultCostCenterId: string | null
  allowedProcessIds: string[]
  defaultProcessId: string | null
}

export type DimensionLookup = {
  activeCostCenterIds: Set<string>
  activeProcessIds: Set<string>
  unitsById: Map<string, { code: string }>
}

function linePrefix(lineNo: number): string {
  return `บรรทัดที่ ${lineNo}: `
}

function resolveMappedDimension(opts: {
  lineNo: number
  inputId: string | null
  allowedIds: string[]
  defaultId: string | null
  requires: boolean
  activeIds: Set<string>
  requiredLabel: string
  invalidLabel: string
  allowlistLabel: string
}): string | null {
  let value = opts.inputId
  if (!value && opts.defaultId) value = opts.defaultId

  if (opts.allowedIds.length > 0) {
    if (value && !opts.allowedIds.includes(value)) {
      throw new ValidationError(`${linePrefix(opts.lineNo)}${opts.allowlistLabel}`)
    }
    if (opts.requires && !value) {
      throw new ValidationError(`${linePrefix(opts.lineNo)}${opts.requiredLabel}`)
    }
    return value
  }

  if (value && !opts.activeIds.has(value)) {
    throw new ValidationError(`${linePrefix(opts.lineNo)}${opts.invalidLabel}`)
  }
  if (opts.requires && !value) {
    throw new ValidationError(`${linePrefix(opts.lineNo)}${opts.requiredLabel}`)
  }
  return value
}

function assertCostObjectDimension(
  lineNo: number,
  type: TypeDimensionMeta,
  costObjectType: (typeof EXPENSE_COST_OBJECT_TYPES)[number] | null,
  costObjectLabel: string | null
): {
  costObjectType: (typeof EXPENSE_COST_OBJECT_TYPES)[number] | null
  costObjectLabel: string | null
} {
  const label = costObjectLabel?.trim() ? costObjectLabel.trim() : null
  const rules: Array<{
    flag: boolean
    expected: (typeof EXPENSE_COST_OBJECT_TYPES)[number]
    typeMsg: string
    labelMsg: string
  }> = [
    {
      flag: type.requiresVehicle,
      expected: "VEHICLE",
      typeMsg: "ประเภทวัตถุต้นทุนต้องเป็นรถ",
      labelMsg: "ต้องระบุรถ",
    },
    {
      flag: type.requiresMachine,
      expected: "MACHINE",
      typeMsg: "ประเภทวัตถุต้นทุนต้องเป็นเครื่องจักร",
      labelMsg: "ต้องระบุเครื่องจักร",
    },
    {
      flag: type.requiresLocation,
      expected: "LOCATION",
      typeMsg: "ประเภทวัตถุต้นทุนต้องเป็นสถานที่",
      labelMsg: "ต้องระบุสถานที่",
    },
  ]
  for (const rule of rules) {
    if (!rule.flag) continue
    if (costObjectType !== rule.expected) {
      throw new ValidationError(`${linePrefix(lineNo)}${rule.typeMsg}`)
    }
    if (!label) {
      throw new ValidationError(`${linePrefix(lineNo)}${rule.labelMsg}`)
    }
  }
  return { costObjectType, costObjectLabel: label }
}

/** Server-side source of truth for type requires_* + allowlists. Client validation is UX only. */
export function assertLineDimensions(
  line: {
    lineNo: number
    pricingMode: (typeof EXPENSE_PRICING_MODES)[number]
    costCenterId: string | null
    processId: string | null
    unitId: string | null
    costObjectType: (typeof EXPENSE_COST_OBJECT_TYPES)[number] | null
    costObjectLabel: string | null
  },
  type: TypeDimensionMeta,
  lookup: DimensionLookup
): {
  costCenterId: string | null
  processId: string | null
  unitId: string | null
  unitCode: string | null
  costObjectType: (typeof EXPENSE_COST_OBJECT_TYPES)[number] | null
  costObjectLabel: string | null
} {
  const costCenterId = resolveMappedDimension({
    lineNo: line.lineNo,
    inputId: line.costCenterId,
    allowedIds: type.allowedCostCenterIds,
    defaultId: type.defaultCostCenterId,
    requires: type.requiresCostCenter,
    activeIds: lookup.activeCostCenterIds,
    requiredLabel: "ต้องระบุหน่วยงานต้นทุน",
    invalidLabel: "หน่วยงานต้นทุนไม่ถูกต้อง",
    allowlistLabel: "หน่วยงานต้นทุนไม่อยู่ในรายการที่อนุญาต",
  })
  const processId = resolveMappedDimension({
    lineNo: line.lineNo,
    inputId: line.processId,
    allowedIds: type.allowedProcessIds,
    defaultId: type.defaultProcessId,
    requires: type.requiresProcess,
    activeIds: lookup.activeProcessIds,
    requiredLabel: "ต้องระบุกระบวนการ",
    invalidLabel: "กระบวนการไม่ถูกต้อง",
    allowlistLabel: "กระบวนการไม่อยู่ในรายการที่อนุญาต",
  })
  const costObject = assertCostObjectDimension(line.lineNo, type, line.costObjectType, line.costObjectLabel)

  let unitId: string | null = null
  let unitCode: string | null = null
  if (line.pricingMode === "QTY_PRICE") {
    if (!line.unitId) {
      throw new ValidationError(`${linePrefix(line.lineNo)}ต้องเลือกหน่วย`)
    }
    const unit = lookup.unitsById.get(line.unitId)
    if (!unit) {
      throw new ValidationError(`${linePrefix(line.lineNo)}หน่วยไม่ถูกต้อง`)
    }
    unitId = line.unitId
    unitCode = unit.code
  }

  return {
    costCenterId,
    processId,
    unitId,
    unitCode,
    costObjectType: costObject.costObjectType,
    costObjectLabel: costObject.costObjectLabel,
  }
}

export function assertHeaderVendor(types: Array<{ requiresVendor: boolean }>, vendorId: string | null) {
  if (types.some((t) => t.requiresVendor) && !vendorId) {
    throw new ValidationError("ต้องระบุผู้ขาย")
  }
}

function toTypeDimensionMeta(row: {
  id: string
  requiresVendor: boolean
  requiresVehicle: boolean
  requiresMachine: boolean
  requiresLocation: boolean
  requiresCostCenter: boolean
  requiresProcess: boolean
  costCenterMaps: Array<{ costCenterId: string; isDefault: boolean; isAllowed: boolean }>
  processMaps: Array<{ processId: string; isDefault: boolean; isAllowed: boolean }>
}): TypeDimensionMeta {
  return {
    id: row.id,
    requiresVendor: row.requiresVendor,
    requiresVehicle: row.requiresVehicle,
    requiresMachine: row.requiresMachine,
    requiresLocation: row.requiresLocation,
    requiresCostCenter: row.requiresCostCenter,
    requiresProcess: row.requiresProcess,
    allowedCostCenterIds: row.costCenterMaps.filter((m) => m.isAllowed).map((m) => m.costCenterId),
    defaultCostCenterId: row.costCenterMaps.find((m) => m.isDefault)?.costCenterId ?? null,
    allowedProcessIds: row.processMaps.filter((m) => m.isAllowed).map((m) => m.processId),
    defaultProcessId: row.processMaps.find((m) => m.isDefault)?.processId ?? null,
  }
}

async function loadDimensionContext(
  db: PrismaClient,
  companyId: string,
  lineInputs: ExpenseLineInput[]
): Promise<{ typeById: Map<string, TypeDimensionMeta>; lookup: DimensionLookup }> {
  const typeIds = [...new Set(lineInputs.map((l) => l.expenseTypeId))]
  const unitIds = [...new Set(lineInputs.map((l) => l.unitId).filter((id): id is string => !!id))]

  const [typeRows, unitRows, costCenters, processes] = await Promise.all([
    db.expenseType.findMany({
      where: { id: { in: typeIds }, companyId },
      select: {
        id: true,
        requiresVendor: true,
        requiresVehicle: true,
        requiresMachine: true,
        requiresLocation: true,
        requiresCostCenter: true,
        requiresProcess: true,
        costCenterMaps: { select: { costCenterId: true, isDefault: true, isAllowed: true } },
        processMaps: { select: { processId: true, isDefault: true, isAllowed: true } },
      },
    }),
    unitIds.length
      ? db.unit.findMany({
          where: { companyId, id: { in: unitIds } },
          select: { id: true, code: true },
        })
      : Promise.resolve([] as Array<{ id: string; code: string }>),
    db.costCenter.findMany({ where: { companyId, isActive: true }, select: { id: true } }),
    db.process.findMany({ where: { companyId, isActive: true }, select: { id: true } }),
  ])

  if (typeRows.length !== typeIds.length) throw new ValidationError("ประเภทค่าใช้จ่ายไม่ถูกต้อง")

  return {
    typeById: new Map(typeRows.map((r) => [r.id, toTypeDimensionMeta(r)])),
    lookup: {
      activeCostCenterIds: new Set(costCenters.map((c) => c.id)),
      activeProcessIds: new Set(processes.map((p) => p.id)),
      unitsById: new Map(unitRows.map((u) => [u.id, { code: u.code }])),
    },
  }
}

/**
 * Validate + normalize a set of line inputs into DB-ready lines:
 * - MANUAL lines: amount from qty*price or the entered amount.
 * - Linked TRANSPORT lines: amount is re-derived from the transport module so a
 *   client cannot tamper with a locked amount; tax/discount stay editable.
 * Also computes header roll-ups + the derived header source module.
 * Dimension rules (requires_*, allowlists, vendor, unitId) apply here — not on GET.
 */
async function resolveBill(
  db: PrismaClient,
  params: { companyId: string; lineInputs: ExpenseLineInput[]; vendorId?: string | null }
): Promise<ResolvedBill> {
  const { lineInputs } = params
  if (lineInputs.length === 0) throw new ValidationError("ต้องมีอย่างน้อย 1 บรรทัด")

  const { typeById, lookup } = await loadDimensionContext(db, params.companyId, lineInputs)

  // Re-derive authoritative amounts for TRANSPORT-linked lines.
  const transportIdentities = lineInputs
    .filter(
      (l) =>
        (l.sourceKind === "IMPORT" || l.sourceKind === "MODULE") &&
        l.sourceModule === "TRANSPORT" &&
        !!l.sourceDocumentId &&
        !!l.sourceType
    )
    .map((l) => ({ sourceType: l.sourceType as string, sourceDocumentId: l.sourceDocumentId as string }))

  const resolvedSources = transportIdentities.length
    ? await resolveTransportSources(db, { companyId: params.companyId, identities: transportIdentities })
    : new Map()

  const lines: ResolvedLine[] = []
  const identities: SourceIdentity[] = []
  const seen = new Set<string>()

  let lineNo = 1
  for (const input of lineInputs) {
    const sourceKind = input.sourceKind ?? "MANUAL"
    const linked = sourceKind !== "MANUAL" && !!input.sourceModule && !!input.sourceDocumentId

    let pricingMode: (typeof EXPENSE_PRICING_MODES)[number] = input.pricingMode ?? "AMOUNT"
    let quantity = input.quantity ?? 1
    let unitPrice = input.unitPrice ?? 0
    let amount = input.amount ?? 0

    if (linked && input.sourceModule === "TRANSPORT") {
      const key = `${input.sourceType}::${input.sourceDocumentId}`
      const resolved = resolvedSources.get(key)
      if (!resolved) {
        throw new ValidationError("ไม่พบเอกสารต้นทาง หรือถูกแก้ไข/ผูกไปแล้ว")
      }
      if (isLockedReferenceAmount(resolved.amount)) {
        // Locked fields come from the source, not the client.
        pricingMode = "AMOUNT"
        quantity = 1
        amount = resolved.amount as number
        unitPrice = resolved.amount as number
      } else if (pricingMode === "QTY_PRICE") {
        amount = round2(quantity * unitPrice)
      } else {
        quantity = quantity || 1
        unitPrice = amount
      }
    } else if (pricingMode === "QTY_PRICE") {
      amount = round2(quantity * unitPrice)
    } else {
      // AMOUNT mode: keep entered amount; mirror it onto unit price for display.
      quantity = quantity || 1
      unitPrice = amount
    }

    const taxAmount = round2(input.taxAmount ?? 0)
    const discountAmount = round2(input.discountAmount ?? 0)
    const netAmount = computeNet(amount, taxAmount, discountAmount)

    const sourceModule = linked ? (input.sourceModule as (typeof EXPENSE_SOURCE_MODULES)[number]) : null
    const sourceType = linked ? input.sourceType ?? null : null
    const sourceDocumentId = linked ? input.sourceDocumentId ?? null : null
    const sourceLineId = linked ? input.sourceLineId ?? null : null

    if (linked && sourceModule && sourceDocumentId) {
      const dupKey = `${sourceModule}::${sourceType ?? ""}::${sourceDocumentId}::${sourceLineId ?? ""}`
      if (seen.has(dupKey)) {
        throw new ValidationError("มีต้นทางซ้ำในบิลเดียวกัน")
      }
      seen.add(dupKey)
      identities.push({ sourceModule, sourceType, sourceDocumentId, sourceLineId })
    }

    const typeMeta = typeById.get(input.expenseTypeId)
    if (!typeMeta) throw new ValidationError("ประเภทค่าใช้จ่ายไม่ถูกต้อง")
    const dims = assertLineDimensions(
      {
        lineNo,
        pricingMode,
        costCenterId: input.costCenterId ?? null,
        processId: input.processId ?? null,
        unitId: pricingMode === "QTY_PRICE" ? (input.unitId ?? null) : null,
        costObjectType: input.costObjectType ?? null,
        costObjectLabel: input.costObjectLabel ?? null,
      },
      typeMeta,
      lookup
    )

    lines.push({
      lineNo: lineNo++,
      expenseTypeId: input.expenseTypeId,
      description: input.description ?? null,
      pricingMode,
      quantity,
      unitId: dims.unitId,
      unitCode: dims.unitCode,
      unitPrice,
      amount,
      taxAmount,
      discountAmount,
      netAmount,
      costCenterId: dims.costCenterId,
      processId: dims.processId,
      costObjectType: dims.costObjectType,
      costObjectId: input.costObjectId ?? null,
      costObjectLabel: dims.costObjectLabel,
      sourceKind: linked ? sourceKind : "MANUAL",
      sourceModule,
      sourceType,
      sourceDocumentId,
      sourceLineId,
    })
  }

  assertHeaderVendor([...typeById.values()], params.vendorId ?? null)

  const amount = round2(lines.reduce((s, l) => s + l.amount, 0))
  const taxAmount = round2(lines.reduce((s, l) => s + l.taxAmount, 0))
  const discountAmount = round2(lines.reduce((s, l) => s + l.discountAmount, 0))
  const netAmount = round2(lines.reduce((s, l) => s + l.netAmount, 0))

  const modules = [...new Set(lines.map((l) => l.sourceModule).filter((m): m is (typeof EXPENSE_SOURCE_MODULES)[number] => !!m))]
  const derivedModule = modules.length === 1 ? modules[0] : null

  return {
    lines,
    primaryTypeId: lines[0].expenseTypeId,
    derivedModule,
    amount,
    taxAmount,
    discountAmount,
    netAmount,
    identities,
  }
}

function toLineCreate(companyId: string, line: ResolvedLine): Prisma.ExpenseLineCreateWithoutExpenseInput {
  return {
    companyId,
    lineNo: line.lineNo,
    expenseType: { connect: { id: line.expenseTypeId } },
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
    costObjectType: line.costObjectType,
    costObjectId: line.costObjectId,
    costObjectLabel: line.costObjectLabel,
    sourceKind: line.sourceKind,
    sourceModule: line.sourceModule,
    sourceType: line.sourceType,
    sourceDocumentId: line.sourceDocumentId,
    sourceLineId: line.sourceLineId,
    sourceLinkActive: true,
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
}

// ─── Query helpers ───────────────────────────────────────────────────────────

function expenseWhere(
  companyId: string,
  roles: UserRole[],
  branchId?: string | null
): Prisma.ExpenseWhereInput {
  const isAdmin = isAdminInAnyBranch(roles)
  const allowed = getBranchIds(roles)
  const base: Prisma.ExpenseWhereInput = { companyId, deletedAt: null }
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

const expenseInclude = {
  branch: { select: { id: true, name: true } },
  vendor: { select: { id: true, name: true } },
  employee: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  paidBy: { select: { id: true, firstName: true, lastName: true } },
  creator: { select: { id: true, firstName: true, lastName: true } },
  attachments: { orderBy: { createdAt: "asc" as const } },
  lines: {
    orderBy: { lineNo: "asc" as const },
    include: {
      expenseType: { select: { id: true, name: true, transactionType: true } },
      costCenter: { select: { id: true, name: true } },
      process: { select: { id: true, name: true } },
      unit: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.ExpenseInclude

type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>
type ExpenseLineRow = ExpenseRow["lines"][number]

function fullName(u: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!u) return null
  return `${u.firstName} ${u.lastName}`.trim()
}

function serializeLine(line: ExpenseLineRow) {
  return {
    id: line.id,
    lineNo: line.lineNo,
    expenseTypeId: line.expenseTypeId,
    expenseTypeName: line.expenseType.name,
    transactionType: line.expenseType.transactionType,
    description: line.description,
    pricingMode: line.pricingMode,
    quantity: Number(line.quantity),
    unitId: line.unitId,
    unitCode: line.unitCode ?? line.unit?.code ?? null,
    unitPrice: Number(line.unitPrice),
    amount: Number(line.amount),
    taxAmount: Number(line.taxAmount),
    discountAmount: Number(line.discountAmount),
    netAmount: Number(line.netAmount),
    costCenterId: line.costCenterId,
    costCenterName: line.costCenter?.name ?? null,
    processId: line.processId,
    processName: line.process?.name ?? null,
    costObjectType: line.costObjectType,
    costObjectId: line.costObjectId,
    costObjectLabel: line.costObjectLabel,
    sourceKind: line.sourceKind,
    sourceModule: line.sourceModule,
    sourceType: line.sourceType,
    sourceDocumentId: line.sourceDocumentId,
    sourceLineId: line.sourceLineId,
    sourceLinkActive: line.sourceLinkActive,
    sourceDocumentNo: null as string | null,
  }
}

export type ExpenseLineDto = ReturnType<typeof serializeLine>

function serializeExpense(row: ExpenseRow) {
  const lines = row.lines.map(serializeLine)
  const primary = lines[0]
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    branchName: row.branch.name,
    expenseNo: row.expenseNo,
    expenseDate: isoDate(row.expenseDate),
    postingDate: row.postingDate ? isoDate(row.postingDate) : isoDate(row.expenseDate),
    expenseTypeId: primary?.expenseTypeId ?? row.expenseTypeId,
    expenseTypeName: primary?.expenseTypeName ?? "",
    transactionType: primary?.transactionType ?? "EXPENSE",
    sourceModule: row.sourceModule,
    sourceType: primary?.sourceType ?? row.sourceType,
    sourceId: primary?.sourceDocumentId ?? row.sourceId,
    costCenterId: primary?.costCenterId ?? null,
    costCenterName: primary?.costCenterName ?? null,
    costObjectType: primary?.costObjectType ?? null,
    costObjectId: primary?.costObjectId ?? null,
    costObjectLabel: primary?.costObjectLabel ?? null,
    vendorId: row.vendorId,
    vendorName: row.vendor?.name ?? null,
    employeeId: row.employeeId,
    employeeName: fullName(row.employee),
    amount: Number(row.amount),
    taxAmount: Number(row.taxAmount),
    discountAmount: Number(row.discountAmount),
    netAmount: Number(row.netAmount),
    currency: row.currency,
    description: primary?.description ?? null,
    notes: row.notes,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    paidById: row.paidById,
    paidByName: fullName(row.paidBy),
    approvedById: row.approvedById,
    approvedByName: fullName(row.approvedBy),
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdById: row.createdById,
    createdByName: fullName(row.creator),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      fileSize: a.fileSize,
    })),
    lines,
    lineCount: lines.length,
  }
}

export type ExpenseDto = ReturnType<typeof serializeExpense>

async function attachSourceDocumentNos(
  db: PrismaClient,
  companyId: string,
  dto: ExpenseDto
): Promise<ExpenseDto> {
  const repairIds: string[] = []
  const tireIds: string[] = []
  const jobIds: string[] = []
  for (const line of dto.lines) {
    if (!line.sourceDocumentId) continue
    if (line.sourceType === "TRANSPORT_REPAIR") repairIds.push(line.sourceDocumentId)
    else if (line.sourceType === "TRANSPORT_TIRE") tireIds.push(line.sourceDocumentId)
    else if (line.sourceType === "TRANSPORT_JOB") jobIds.push(line.sourceDocumentId)
  }
  if (repairIds.length === 0 && tireIds.length === 0 && jobIds.length === 0) return dto
  const sources = await getTransportCostSourcesByIds(db, { companyId, repairIds, tireIds, jobIds })
  const nos = new Map(sources.map((s) => [`${s.sourceType}::${s.sourceId}`, s.documentNo]))
  return {
    ...dto,
    lines: dto.lines.map((line) => ({
      ...line,
      sourceDocumentNo:
        line.sourceType && line.sourceDocumentId
          ? nos.get(`${line.sourceType}::${line.sourceDocumentId}`) ?? null
          : null,
    })),
  }
}

async function toExpenseDto(db: PrismaClient, companyId: string, row: ExpenseRow): Promise<ExpenseDto> {
  return attachSourceDocumentNos(db, companyId, serializeExpense(row))
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function listExpenses(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    branchId?: string | null
    expenseTypeId?: string | null
    costCenterId?: string | null
    processId?: string | null
    vendorId?: string | null
    status?: string | null
    sourceModule?: string | null
    dateFrom?: string | null
    dateTo?: string | null
    search?: string | null
  }
) {
  if (!canExpenses(params.roles, "read")) throw new ForbiddenError()
  const where: Prisma.ExpenseWhereInput = expenseWhere(params.companyId, params.roles, params.branchId)
  const and: Prisma.ExpenseWhereInput[] = []

  const expenseTypeId = optionalUuid(params.expenseTypeId)
  if (expenseTypeId) and.push({ lines: { some: { expenseTypeId } } })
  const costCenterId = optionalUuid(params.costCenterId)
  if (costCenterId) and.push({ lines: { some: { costCenterId } } })
  const processRaw = params.processId?.trim()
  if (processRaw === "none") {
    and.push({ lines: { some: { processId: null } } })
  } else {
    const processId = optionalUuid(processRaw)
    if (processId) and.push({ lines: { some: { processId } } })
  }
  const vendorId = optionalUuid(params.vendorId)
  if (vendorId) where.vendorId = vendorId
  if (params.status && (EXPENSE_STATUSES as readonly string[]).includes(params.status)) {
    where.status = params.status as ExpenseStatusValue
  }
  if (params.sourceModule === "MANUAL") {
    and.push({ lines: { some: { sourceModule: null } } })
  } else if (isSourceModule(params.sourceModule)) {
    and.push({ lines: { some: { sourceModule: params.sourceModule } } })
  }
  if (params.dateFrom?.trim() || params.dateTo?.trim()) {
    const range: Prisma.DateTimeFilter = {}
    if (params.dateFrom?.trim()) range.gte = parseDateOnly(params.dateFrom.trim())
    if (params.dateTo?.trim()) range.lte = parseDateOnly(params.dateTo.trim())
    where.expenseDate = range
  }
  if (params.search?.trim()) {
    const q = params.search.trim()
    where.OR = [
      { expenseNo: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      {
        lines: {
          some: {
            OR: [
              { description: { contains: q, mode: "insensitive" } },
              { costObjectLabel: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ]
  }
  if (and.length) where.AND = and

  const rows = await db.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    take: 300,
  })
  return { data: rows.map(serializeExpense) }
}

export async function getExpense(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canExpenses(params.roles, "read")) throw new ForbiddenError()
  const row = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    include: expenseInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  return { data: await toExpenseDto(db, params.companyId, row) }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createExpense(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    input: CreateExpenseInput
    audit?: ExpenseAuditMeta
  }
) {
  assertExpensePermission(params.roles, params.input.branchId, "create")
  await assertBranchAllowed(db, params.companyId, params.input.branchId, params.roles)

  const lineInputs = coerceLineInputs(params.input)
  if (!lineInputs) throw new ValidationError("ต้องมีอย่างน้อย 1 บรรทัด")

  const bill = await resolveBill(db, {
    companyId: params.companyId,
    lineInputs,
    vendorId: params.input.vendorId ?? null,
  })
  await assertSourceLinesNotLinked(db, { companyId: params.companyId, identities: bill.identities })

  const expenseNo = await generateExpenseNo(db, params.companyId)

  try {
    const row = await db.expense.create({
      data: {
        companyId: params.companyId,
        branchId: params.input.branchId,
        expenseNo,
        expenseDate: parseDateOnly(params.input.expenseDate),
        postingDate: params.input.postingDate
          ? parseDateOnly(params.input.postingDate)
          : parseDateOnly(params.input.expenseDate),
        expenseTypeId: bill.primaryTypeId,
        sourceModule: bill.derivedModule,
        sourceType: null,
        sourceId: null,
        vendorId: params.input.vendorId ?? null,
        employeeId: params.input.employeeId ?? null,
        amount: bill.amount,
        taxAmount: bill.taxAmount,
        discountAmount: bill.discountAmount,
        netAmount: bill.netAmount,
        paymentMethod: params.input.paymentMethod ?? null,
        notes: params.input.notes ?? null,
        status: params.input.status ?? "DRAFT",
        createdById: params.userId,
        lines: { create: bill.lines.map((l) => toLineCreate(params.companyId, l)) },
      },
      include: expenseInclude,
    })
    await markReviewsExpenseCreated(db, {
      companyId: params.companyId,
      identities: bill.identities,
      userId: params.userId,
    })
    await writeExpenseAudit(db, {
      userId: params.userId,
      recordId: row.id,
      action: "create",
      event: "EXPENSE_CREATE",
      branchId: row.branchId,
      newValues: {
        expenseNo: row.expenseNo,
        status: row.status,
        netAmount: Number(row.netAmount),
      },
      audit: params.audit,
    })
    return { data: serializeExpense(row) }
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")
    }
    throw err
  }
}

const EDITABLE_STATUSES: ExpenseStatusValue[] = ["DRAFT", "PENDING", "REJECTED"]

const PAID_LOCKED_MSG = "บิลที่จ่ายแล้วแก้ได้เฉพาะหมวดและข้อมูลอ้างอิง ยอดเงินถูกล็อก"

function paidLineFinancialsChanged(
  row: {
    pricingMode: string
    quantity: unknown
    unitPrice: unknown
    amount: unknown
    taxAmount: unknown
    discountAmount: unknown
    sourceKind: string
    sourceModule: string | null
    sourceType: string | null
    sourceDocumentId: string | null
    sourceLineId: string | null
    costObjectType: string | null
    costObjectId: string | null
    costObjectLabel: string | null
  },
  input: ExpenseLineInput
): boolean {
  if (input.pricingMode && input.pricingMode !== row.pricingMode) return true
  if (input.quantity != null && !qtyEq(input.quantity, Number(row.quantity))) return true
  if (input.unitPrice != null && !moneyEq(input.unitPrice, Number(row.unitPrice))) return true
  if (input.amount != null && !moneyEq(input.amount, Number(row.amount))) return true
  if (input.taxAmount != null && !moneyEq(input.taxAmount, Number(row.taxAmount))) return true
  if (input.discountAmount != null && !moneyEq(input.discountAmount, Number(row.discountAmount))) return true
  if (input.sourceKind && input.sourceKind !== row.sourceKind) return true
  if (input.sourceModule !== undefined && !sameNullable(input.sourceModule, row.sourceModule)) return true
  if (input.sourceType !== undefined && !sameNullable(input.sourceType, row.sourceType)) return true
  if (input.sourceDocumentId !== undefined && !sameNullable(input.sourceDocumentId, row.sourceDocumentId)) {
    return true
  }
  if (input.sourceLineId !== undefined && !sameNullable(input.sourceLineId, row.sourceLineId)) return true
  if (input.costObjectType !== undefined && !sameNullable(input.costObjectType, row.costObjectType)) return true
  if (input.costObjectId !== undefined && !sameNullable(input.costObjectId, row.costObjectId)) return true
  if (input.costObjectLabel !== undefined && !sameNullable(input.costObjectLabel, row.costObjectLabel)) return true
  return false
}

export async function updatePaidExpenseMetadata(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string
    id: string
    input: UpdateExpenseInput
    audit?: ExpenseAuditMeta
  }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    include: {
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true,
          lineNo: true,
          expenseTypeId: true,
          description: true,
          pricingMode: true,
          quantity: true,
          unitId: true,
          unitCode: true,
          unitPrice: true,
          amount: true,
          taxAmount: true,
          discountAmount: true,
          costCenterId: true,
          processId: true,
          costObjectType: true,
          costObjectId: true,
          costObjectLabel: true,
          sourceKind: true,
          sourceModule: true,
          sourceType: true,
          sourceDocumentId: true,
          sourceLineId: true,
        },
      },
    },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "update")
  if (existing.status !== "PAID") {
    throw new ValidationError("ใช้ได้เฉพาะบิลที่จ่ายแล้ว")
  }

  const reason = params.input.reason?.trim()
  if (!reason) {
    throw new ValidationError("กรุณาระบุเหตุผลในการแก้ไขบิลที่จ่ายแล้ว")
  }

  if (params.input.branchId && params.input.branchId !== existing.branchId) {
    throw new ValidationError("ไม่สามารถเปลี่ยนสาขาของบิลที่จ่ายแล้ว")
  }
  if (params.input.status !== undefined) {
    throw new ValidationError(PAID_LOCKED_MSG)
  }
  if (params.input.paymentMethod !== undefined && params.input.paymentMethod !== existing.paymentMethod) {
    throw new ValidationError(PAID_LOCKED_MSG)
  }
  if (params.input.postingDate !== undefined) {
    const next = params.input.postingDate ? params.input.postingDate.slice(0, 10) : null
    const prev = existing.postingDate ? isoDate(existing.postingDate) : null
    if (next !== prev) throw new ValidationError(PAID_LOCKED_MSG)
  }

  let nextExpenseDate = existing.expenseDate
  if (params.input.expenseDate) {
    const nextMonth = bangkokYearMonth(params.input.expenseDate)
    const prevMonth = bangkokYearMonth(existing.expenseDate)
    if (nextMonth !== prevMonth && !hasPermission(params.roles, existing.branchId, "expenses", "approve")) {
      throw new ValidationError("ข้ามเดือนต้องมีสิทธิ์อนุมัติค่าใช้จ่าย")
    }
    nextExpenseDate = parseDateOnly(params.input.expenseDate)
  }

  const lineInputs = coerceLineInputs(params.input)
  const existingLines = existing.lines
  if (lineInputs) {
    if (lineInputs.length !== existingLines.length) {
      throw new ValidationError("ไม่สามารถเพิ่มหรือลบบรรทัดของบิลที่จ่ายแล้ว")
    }
    const byId = new Map(existingLines.map((l) => [l.id, l]))
    const seen = new Set<string>()
    for (const input of lineInputs) {
      if (!input.id || !byId.has(input.id)) {
        throw new ValidationError("บรรทัดไม่ตรงกับบิลเดิม")
      }
      if (seen.has(input.id)) throw new ValidationError("บรรทัดซ้ำ")
      seen.add(input.id)
      const row = byId.get(input.id)
      if (!row || paidLineFinancialsChanged(row, input)) {
        throw new ValidationError(PAID_LOCKED_MSG)
      }
      if (row.pricingMode === "AMOUNT" && input.unitId) {
        throw new ValidationError(PAID_LOCKED_MSG)
      }
    }
  }

  const vendorId =
    params.input.vendorId !== undefined ? (params.input.vendorId ?? null) : existing.vendorId

  type LinePatch = {
    id: string
    expenseTypeId: string
    description: string | null
    costCenterId: string | null
    processId: string | null
    unitId: string | null
    unitCode: string | null
  }
  const linePatches: LinePatch[] = []

  if (lineInputs) {
    const { typeById, lookup } = await loadDimensionContext(db, params.companyId, lineInputs)
    const byId = new Map(existingLines.map((l) => [l.id, l]))
    for (const input of lineInputs) {
      const row = byId.get(input.id as string)
      if (!row) throw new ValidationError("บรรทัดไม่ตรงกับบิลเดิม")
      const type = typeById.get(input.expenseTypeId)
      if (!type) throw new ValidationError("ประเภทค่าใช้จ่ายไม่ถูกต้อง")
      const dims = assertLineDimensions(
        {
          lineNo: row.lineNo,
          pricingMode: row.pricingMode,
          costCenterId: input.costCenterId !== undefined ? (input.costCenterId ?? null) : row.costCenterId,
          processId: input.processId !== undefined ? (input.processId ?? null) : row.processId,
          unitId:
            row.pricingMode === "QTY_PRICE"
              ? (input.unitId !== undefined ? (input.unitId ?? null) : row.unitId)
              : null,
          costObjectType: row.costObjectType,
          costObjectLabel: row.costObjectLabel,
        },
        type,
        lookup
      )
      linePatches.push({
        id: row.id,
        expenseTypeId: input.expenseTypeId,
        description: input.description !== undefined ? (input.description ?? null) : row.description,
        costCenterId: dims.costCenterId,
        processId: dims.processId,
        unitId: dims.unitId,
        unitCode: dims.unitCode,
      })
    }
    assertHeaderVendor(
      linePatches.map((l) => ({ requiresVendor: Boolean(typeById.get(l.expenseTypeId)?.requiresVendor) })),
      vendorId
    )
  } else if (params.input.vendorId === null) {
    const typeIds = [...new Set(existingLines.map((l) => l.expenseTypeId))]
    if (typeIds.length) {
      const types = await db.expenseType.findMany({
        where: { id: { in: typeIds }, companyId: params.companyId },
        select: { requiresVendor: true },
      })
      assertHeaderVendor(types, null)
    }
  }

  const oldValues: Record<string, unknown> = {}
  const newValues: Record<string, unknown> = {}
  const track = (key: string, prev: unknown, next: unknown) => {
    if (JSON.stringify(prev) === JSON.stringify(next)) return
    oldValues[key] = prev
    newValues[key] = next
  }

  track("vendorId", existing.vendorId, vendorId)
  if (params.input.employeeId !== undefined) {
    track("employeeId", existing.employeeId, params.input.employeeId)
  }
  if (params.input.notes !== undefined) track("notes", existing.notes, params.input.notes)
  if (params.input.expenseDate) track("expenseDate", isoDate(existing.expenseDate), isoDate(nextExpenseDate))
  if (linePatches.length) {
    track(
      "lines",
      existingLines.map((l) => ({
        id: l.id,
        expenseTypeId: l.expenseTypeId,
        description: l.description,
        costCenterId: l.costCenterId,
        processId: l.processId,
        unitId: l.unitId,
        unitCode: l.unitCode,
      })),
      linePatches
    )
  }

  const headerData: Prisma.ExpenseUpdateInput = {
    ...(params.input.expenseDate ? { expenseDate: nextExpenseDate } : {}),
    ...(params.input.vendorId !== undefined
      ? vendorId
        ? { vendor: { connect: { id: vendorId } } }
        : { vendor: { disconnect: true } }
      : {}),
    ...(params.input.employeeId !== undefined
      ? params.input.employeeId
        ? { employee: { connect: { id: params.input.employeeId } } }
        : { employee: { disconnect: true } }
      : {}),
    ...(params.input.notes !== undefined ? { notes: params.input.notes } : {}),
    ...(linePatches.length
      ? {
          expenseType: {
            connect: {
              id:
                linePatches.find((p) => p.id === existingLines[0]?.id)?.expenseTypeId ??
                linePatches[0].expenseTypeId,
            },
          },
        }
      : {}),
  }

  await db.$transaction(async (tx) => {
    for (const patch of linePatches) {
      await tx.expenseLine.update({
        where: { id: patch.id },
        data: {
          expenseType: { connect: { id: patch.expenseTypeId } },
          description: patch.description,
          costCenter: patch.costCenterId
            ? { connect: { id: patch.costCenterId } }
            : { disconnect: true },
          process: patch.processId ? { connect: { id: patch.processId } } : { disconnect: true },
          unit: patch.unitId ? { connect: { id: patch.unitId } } : { disconnect: true },
          unitCode: patch.unitCode,
        },
      })
    }
    await tx.expense.update({ where: { id: params.id }, data: headerData })
    if (Object.keys(newValues).length > 0) {
      await writeExpenseAudit(tx, {
        userId: params.userId,
        recordId: params.id,
        action: "update",
        event: "EXPENSE_PAID_METADATA_UPDATE",
        branchId: existing.branchId,
        reason,
        oldValues,
        newValues,
        audit: params.audit,
      })
    }
  })

  const row = await db.expense.findFirst({ where: { id: params.id }, include: expenseInclude })
  if (!row) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  return { data: await toExpenseDto(db, params.companyId, row) }
}

export async function updateExpense(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId?: string
    id: string
    input: UpdateExpenseInput
    audit?: ExpenseAuditMeta
  }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    select: { id: true, status: true, branchId: true, vendorId: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "update")
  if (existing.status === "PAID") {
    return updatePaidExpenseMetadata(db, params)
  }
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new ValidationError("แก้ไขได้เฉพาะรายการที่ยังไม่อนุมัติ")
  }
  if (params.input.branchId) {
    await assertBranchAllowed(db, params.companyId, params.input.branchId, params.roles)
  }

  const headerData: Prisma.ExpenseUpdateInput = {
    ...(params.input.branchId ? { branch: { connect: { id: params.input.branchId } } } : {}),
    ...(params.input.expenseDate ? { expenseDate: parseDateOnly(params.input.expenseDate) } : {}),
    ...(params.input.postingDate !== undefined
      ? { postingDate: params.input.postingDate ? parseDateOnly(params.input.postingDate) : null }
      : {}),
    ...(params.input.vendorId !== undefined
      ? params.input.vendorId
        ? { vendor: { connect: { id: params.input.vendorId } } }
        : { vendor: { disconnect: true } }
      : {}),
    ...(params.input.employeeId !== undefined
      ? params.input.employeeId
        ? { employee: { connect: { id: params.input.employeeId } } }
        : { employee: { disconnect: true } }
      : {}),
    ...(params.input.paymentMethod !== undefined ? { paymentMethod: params.input.paymentMethod } : {}),
    ...(params.input.notes !== undefined ? { notes: params.input.notes } : {}),
    ...(params.input.status ? { status: params.input.status } : {}),
  }

  const lineInputs = coerceLineInputs(params.input)
  const vendorId =
    params.input.vendorId !== undefined ? (params.input.vendorId ?? null) : existing.vendorId

  try {
    if (lineInputs) {
      const bill = await resolveBill(db, { companyId: params.companyId, lineInputs, vendorId })
      await assertSourceLinesNotLinked(db, {
        companyId: params.companyId,
        identities: bill.identities,
        ignoreExpenseId: params.id,
      })
      await db.$transaction(async (tx) => {
        await tx.expenseLine.deleteMany({ where: { expenseId: params.id } })
        await tx.expense.update({
          where: { id: params.id },
          data: {
            ...headerData,
            expenseType: { connect: { id: bill.primaryTypeId } },
            sourceModule: bill.derivedModule,
            amount: bill.amount,
            taxAmount: bill.taxAmount,
            discountAmount: bill.discountAmount,
            netAmount: bill.netAmount,
            lines: { create: bill.lines.map((l) => toLineCreate(params.companyId, l)) },
          },
        })
      })
      await markReviewsExpenseCreated(db, {
        companyId: params.companyId,
        identities: bill.identities,
      })
    } else {
      if (params.input.vendorId === null) {
        const existingLines = await db.expenseLine.findMany({
          where: { expenseId: params.id },
          select: { expenseTypeId: true },
        })
        const typeIds = [...new Set(existingLines.map((l) => l.expenseTypeId))]
        if (typeIds.length) {
          const types = await db.expenseType.findMany({
            where: { id: { in: typeIds }, companyId: params.companyId },
            select: { requiresVendor: true },
          })
          assertHeaderVendor(types, null)
        }
      }
      await db.expense.update({ where: { id: params.id }, data: headerData })
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")
    }
    throw err
  }

  const row = await db.expense.findFirst({ where: { id: params.id }, include: expenseInclude })
  if (!row) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  await writeExpenseAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "EXPENSE_UPDATE",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: {
      status: row.status,
      ...(params.input.branchId ? { branchId: params.input.branchId } : {}),
    },
    audit: params.audit,
  })
  return { data: serializeExpense(row) }
}

export async function approveExpense(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    audit?: ExpenseAuditMeta
  }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    select: { id: true, status: true, branchId: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "approve")
  if (existing.status !== "DRAFT" && existing.status !== "PENDING") {
    throw new ValidationError("อนุมัติได้เฉพาะรายการที่รอดำเนินการ")
  }
  const row = await db.expense.update({
    where: { id: params.id },
    data: { status: "APPROVED", approvedById: params.userId, approvedAt: new Date() },
    include: expenseInclude,
  })
  await writeExpenseAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "EXPENSE_APPROVE",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: "APPROVED" },
    audit: params.audit,
  })
  return { data: serializeExpense(row) }
}

export async function rejectExpense(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    audit?: ExpenseAuditMeta
  }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    select: { id: true, status: true, branchId: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "approve")
  if (existing.status === "PAID") {
    throw new ValidationError("ไม่สามารถปฏิเสธรายการที่จ่ายแล้ว")
  }
  const row = await db.expense.update({
    where: { id: params.id },
    data: { status: "REJECTED", approvedById: params.userId, approvedAt: new Date() },
    include: expenseInclude,
  })
  await writeExpenseAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "EXPENSE_REJECT",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: "REJECTED" },
    audit: params.audit,
  })
  return { data: serializeExpense(row) }
}

export async function markExpensePaid(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    input?: z.infer<typeof payExpenseSchema>
    audit?: ExpenseAuditMeta
  }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    select: { id: true, status: true, paymentMethod: true, branchId: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "update")
  if (existing.status !== "APPROVED") {
    throw new ValidationError("ทำเครื่องหมายจ่ายได้เฉพาะรายการที่อนุมัติแล้ว")
  }
  const paidAt = params.input?.paidAt ? parseDateOnly(params.input.paidAt) : new Date()
  const row = await db.expense.update({
    where: { id: params.id },
    data: {
      status: "PAID",
      paidById: params.userId,
      paidAt,
      ...(params.input?.paymentMethod !== undefined
        ? { paymentMethod: params.input.paymentMethod }
        : {}),
    },
    include: expenseInclude,
  })
  await writeExpenseAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "EXPENSE_PAY",
    branchId: existing.branchId,
    oldValues: { status: existing.status },
    newValues: { status: "PAID" },
    audit: params.audit,
  })
  return { data: serializeExpense(row) }
}

export async function unpayExpense(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    input: { reason?: string | null }
    audit?: ExpenseAuditMeta
  }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    select: {
      id: true,
      status: true,
      branchId: true,
      paidAt: true,
      paidById: true,
      paymentMethod: true,
    },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "approve")
  if (existing.status !== "PAID") {
    throw new ValidationError("ยกเลิกการจ่ายได้เฉพาะรายการที่จ่ายแล้ว")
  }
  const reason = typeof params.input?.reason === "string" ? params.input.reason.trim() : ""
  if (!reason) {
    throw new ValidationError("กรุณาระบุเหตุผลในการยกเลิกการจ่าย")
  }
  if (reason.length > 500) {
    throw new ValidationError("เหตุผลยาวเกินไป")
  }

  const row = await db.expense.update({
    where: { id: params.id },
    data: {
      status: "APPROVED",
      paidAt: null,
      paidBy: { disconnect: true },
    },
    include: expenseInclude,
  })
  await writeExpenseAudit(db, {
    userId: params.userId,
    recordId: params.id,
    action: "update",
    event: "EXPENSE_UNPAY",
    branchId: existing.branchId,
    reason,
    oldValues: {
      status: existing.status,
      paidAt: existing.paidAt ? existing.paidAt.toISOString() : null,
      paidById: existing.paidById,
    },
    newValues: {
      status: "APPROVED",
      paidAt: null,
      paidById: null,
    },
    audit: params.audit,
  })
  return { data: serializeExpense(row) }
}

export async function deleteExpense(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    select: { id: true, status: true, branchId: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "delete")
  if (existing.status === "PAID") {
    throw new ValidationError("ไม่สามารถลบรายการที่จ่ายแล้ว")
  }
  const linkedLines = await db.expenseLine.findMany({
    where: { expenseId: params.id, sourceDocumentId: { not: null } },
    select: {
      sourceModule: true,
      sourceType: true,
      sourceDocumentId: true,
      sourceLineId: true,
    },
  })
  // Release any source links so the upstream documents can be linked again.
  await db.$transaction([
    db.expenseLine.updateMany({ where: { expenseId: params.id }, data: { sourceLinkActive: false } }),
    db.expense.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: "CANCELLED" } }),
  ])
  await reopenReviewsOnExpenseCancel(db, {
    companyId: params.companyId,
    identities: linkedLines
      .filter((l): l is typeof l & { sourceModule: string; sourceDocumentId: string } =>
        Boolean(l.sourceModule && l.sourceDocumentId)
      )
      .map((l) => ({
        sourceModule: l.sourceModule,
        sourceType: l.sourceType,
        sourceDocumentId: l.sourceDocumentId,
        sourceLineId: l.sourceLineId,
      })),
  })
  return { data: { id: params.id } }
}

export async function addExpenseAttachment(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    id: string
    input: z.infer<typeof expenseAttachmentInputSchema>
  }
) {
  const existing = await db.expense.findFirst({
    where: { id: params.id, ...expenseWhere(params.companyId, params.roles) },
    select: { id: true, status: true, branchId: true },
  })
  if (!existing) throw new NotFoundError("ไม่พบรายการค่าใช้จ่าย")
  assertExpensePermission(params.roles, existing.branchId, "update")
  if (existing.status === "CANCELLED") {
    throw new ValidationError("ไม่สามารถแนบไฟล์กับบิลที่ยกเลิกแล้ว")
  }
  const row = await db.expenseAttachment.create({
    data: {
      expenseId: params.id,
      fileUrl: params.input.fileUrl,
      fileName: params.input.fileName ?? null,
      fileSize: params.input.fileSize ?? null,
      uploadedBy: params.userId,
    },
  })
  await db.auditLog.create({
    data: {
      userId: params.userId,
      tableName: "expense_attachments",
      recordId: row.id,
      action: "create",
      newValues: { expenseId: params.id, fileName: row.fileName, fileUrl: row.fileUrl },
    },
  })
  return {
    data: {
      id: row.id,
      fileUrl: row.fileUrl,
      fileName: row.fileName,
      fileSize: row.fileSize,
    },
  }
}

// ─── Summary + form option lists ─────────────────────────────────────────────

export async function getExpenseSummary(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId?: string | null }
) {
  if (!canExpenses(params.roles, "read")) throw new ForbiddenError()
  const rows = await db.expense.findMany({
    where: expenseWhere(params.companyId, params.roles, params.branchId),
    select: { status: true, netAmount: true },
    take: 5000,
  })
  const counts: Record<ExpenseStatusValue, number> = {
    DRAFT: 0,
    PENDING: 0,
    APPROVED: 0,
    PAID: 0,
    REJECTED: 0,
    CANCELLED: 0,
  }
  const totals: Record<ExpenseStatusValue, number> = {
    DRAFT: 0,
    PENDING: 0,
    APPROVED: 0,
    PAID: 0,
    REJECTED: 0,
    CANCELLED: 0,
  }
  for (const r of rows) {
    counts[r.status] += 1
    totals[r.status] = round2(totals[r.status] + Number(r.netAmount))
  }
  return { counts, totals }
}

export async function listExpenseBranches(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canExpenses(params.roles, "read")) throw new ForbiddenError()
  const isAdmin = isAdminInAnyBranch(params.roles)
  const allowed = getBranchIds(params.roles)
  const branches = await db.branch.findMany({
    where: {
      companyId: params.companyId,
      deletedAt: null,
      isActive: true,
      ...(isAdmin
        ? {}
        : { id: { in: allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"] } }),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return { data: branches }
}

export async function listExpenseVendors(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canExpenses(params.roles, "read")) throw new ForbiddenError()
  const vendors = await db.supplier.findMany({
    where: { companyId: params.companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  })
  return { data: vendors }
}

export async function listExpenseEmployees(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[] }
) {
  if (!canExpenses(params.roles, "read")) throw new ForbiddenError()
  const users = await db.user.findMany({
    where: { companyId: params.companyId, deletedAt: null, isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500,
  })
  return { data: users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })) }
}

export {
  computeNet as _computeNetForTests,
  assertLineDimensions as _assertLineDimensionsForTests,
  assertHeaderVendor as _assertHeaderVendorForTests,
  bangkokYearMonth as _bangkokYearMonthForTests,
}
