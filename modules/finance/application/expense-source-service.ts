import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import { readBranchSharing } from "@/shared/permissions/branch-sharing"
import {
  getTransportCostSourcesByIds,
  listTransportCostSources,
  type TransportCostSource,
  type TransportSourceExcludeIds,
} from "@/modules/transport"
import {
  getProcurementCostSourcesByIds,
  listProcurementCostSources,
  type ProcurementCostSource,
  type ProcurementCostSourceLine,
} from "@/modules/procurement"
import {
  reviewBlocksCreate,
  shouldReopenReviewOnExpenseCancel,
  sourceReviewDocKey,
  type FinanceSourceReviewStatus,
} from "./expense-source-review"

function canExpensesRead(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "expenses", "read"))
  )
}

function canExpensesWrite(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some(
      (bid) =>
        hasPermission(roles, bid, "expenses", "create") ||
        hasPermission(roles, bid, "expenses", "update")
    )
  )
}

/**
 * A cost entry from an upstream module that can be linked into an expense line.
 * `sourceDocumentId` identifies the upstream document; `sourceLineId` stays null
 * while a document maps to a single amount (transport today). `documentNo` is the
 * human code when the operational module has one. `groupKey` lets the
 * UI group many selectable rows under one heading.
 */
export type TransportExpenseSourceDto = TransportCostSource & {
  sourceKind: "IMPORT"
  sourceModule: "TRANSPORT"
  sourceDocumentId: string
  sourceLineId: string | null
  suggestedCostObjectType: "VEHICLE" | "JOB"
  groupKey: string
  groupLabel: string
  reviewStatus: "PENDING"
  branchName: string
}

/**
 * A RECEIVED purchase order. One queue row per order; each order line becomes a
 * bill line linked by `sourceLineId` = order line id.
 */
export type ProcurementExpenseSourceDto = Omit<ProcurementCostSource, "lines"> & {
  sourceKind: "IMPORT"
  sourceModule: "PROCUREMENT"
  sourceDocumentId: string
  sourceLineId: null
  vehicleId: ""
  vehicleLabel: "-"
  assetId: null
  assetLabel: null
  paymentMethod: null
  suggestedCostObjectType: null
  groupKey: string
  groupLabel: string
  reviewStatus: "PENDING"
  branchName: string
  lines: ProcurementCostSourceLine[]
}

export type ExpenseSourceDto = TransportExpenseSourceDto | ProcurementExpenseSourceDto

const GROUP_LABELS: Record<string, string> = {
  TRANSPORT: "ขนส่ง",
  PROCUREMENT: "จัดซื้อ",
}

function sourceKey(sourceType: string, sourceDocumentId: string): string {
  return `${sourceType}::${sourceDocumentId}`
}

function toProcurementDto(s: ProcurementCostSource, branchNames: Map<string, string>): ProcurementExpenseSourceDto {
  return {
    ...s,
    sourceKind: "IMPORT",
    sourceModule: "PROCUREMENT",
    sourceDocumentId: s.sourceId,
    sourceLineId: null,
    vehicleId: "",
    vehicleLabel: "-",
    assetId: null,
    assetLabel: null,
    paymentMethod: null,
    suggestedCostObjectType: null,
    groupKey: "PROCUREMENT",
    groupLabel: GROUP_LABELS.PROCUREMENT,
    reviewStatus: "PENDING",
    branchName: branchNames.get(s.branchId) ?? "—",
  }
}

function toSourceDto(s: TransportCostSource, branchNames: Map<string, string>): TransportExpenseSourceDto {
  return {
    ...s,
    sourceKind: "IMPORT",
    sourceModule: "TRANSPORT",
    sourceDocumentId: s.sourceId,
    sourceLineId: null,
    suggestedCostObjectType: s.sourceType === "TRANSPORT_JOB" ? "JOB" : "VEHICLE",
    groupKey: "TRANSPORT",
    groupLabel: GROUP_LABELS.TRANSPORT,
    reviewStatus: "PENDING",
    branchName: branchNames.get(s.branchId) ?? "—",
  }
}

async function loadBranchNames(
  db: PrismaClient,
  companyId: string,
  branchIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(branchIds.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const rows = await db.branch.findMany({
    where: { companyId, id: { in: unique } },
    select: { id: true, name: true },
  })
  return new Map(rows.map((r) => [r.id, r.name]))
}

function pushClosedSourceId(
  bucket: Required<TransportSourceExcludeIds>,
  sourceType: string | null,
  sourceDocumentId: string | null
) {
  if (!sourceDocumentId) return
  if (sourceType === "TRANSPORT_REPAIR") bucket.repairIds.push(sourceDocumentId)
  else if (sourceType === "TRANSPORT_TIRE") bucket.tireIds.push(sourceDocumentId)
  else if (sourceType === "TRANSPORT_JOB") bucket.jobIds.push(sourceDocumentId)
}

/** Company-wide closed identities. Not limited to a candidate id window. */
async function loadClosedTransportSourceIds(
  db: PrismaClient,
  companyId: string
): Promise<Required<TransportSourceExcludeIds>> {
  const bucket: Required<TransportSourceExcludeIds> = { repairIds: [], tireIds: [], jobIds: [] }
  const [linked, reviews] = await Promise.all([
    db.expenseLine.findMany({
      where: {
        companyId,
        sourceModule: "TRANSPORT",
        sourceLinkActive: true,
        expense: { deletedAt: null },
      },
      select: { sourceType: true, sourceDocumentId: true },
    }),
    db.financeSourceReview.findMany({
      where: {
        companyId,
        sourceModule: "TRANSPORT",
        status: { in: ["NO_EXPENSE", "EXPENSE_CREATED"] },
      },
      select: { sourceType: true, sourceDocumentId: true, status: true },
    }),
  ])
  for (const row of linked) pushClosedSourceId(bucket, row.sourceType, row.sourceDocumentId)
  for (const row of reviews) {
    if (!reviewBlocksCreate(row.status as FinanceSourceReviewStatus)) continue
    pushClosedSourceId(bucket, row.sourceType, row.sourceDocumentId)
  }
  return bucket
}

/**
 * List finance-ready operational sources that still need review.
 * Excludes active Expense links and reviews in NO_EXPENSE / EXPENSE_CREATED.
 * Missing review row = PENDING.
 * Closed rows are loaded for the whole company before the transport read,
 * so an older open job is not dropped behind a capped window of newer closed jobs.
 */
export async function listUnlinkedExpenseSources(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId?: string | null }
) {
  if (!canExpensesRead(params.roles)) throw new ForbiddenError()

  const shareView = (await readBranchSharing(db, params.companyId)).finance.view
  const isAdmin = isAdminInAnyBranch(params.roles) || shareView
  let branchIds: string[] | null = isAdmin ? null : getBranchIds(params.roles)
  if (params.branchId) {
    if (!isAdmin && !getBranchIds(params.roles).includes(params.branchId)) {
      return { data: [] as ExpenseSourceDto[] }
    }
    branchIds = [params.branchId]
  }

  const [transport, procurement] = await Promise.all([
    listPendingTransportSources(db, params.companyId, branchIds),
    listProcurementCostSources(db, {
      companyId: params.companyId,
      branchIds,
      excludeIds: await loadClosedProcurementSourceIds(db, params.companyId),
    }),
  ])
  const branchNames = await loadBranchNames(
    db,
    params.companyId,
    [...transport, ...procurement].map((s) => s.branchId)
  )
  const data: ExpenseSourceDto[] = [
    ...transport.map((s) => toSourceDto(s, branchNames)),
    ...procurement.map((s) => toProcurementDto(s, branchNames)),
  ]
  return { data }
}

/** Company-wide purchase order ids already billed or closed as no-expense. */
async function loadClosedProcurementSourceIds(db: PrismaClient, companyId: string): Promise<string[]> {
  const [linked, reviews] = await Promise.all([
    db.expenseLine.findMany({
      where: {
        companyId,
        sourceModule: "PROCUREMENT",
        sourceLinkActive: true,
        expense: { deletedAt: null },
      },
      select: { sourceDocumentId: true },
      distinct: ["sourceDocumentId"],
    }),
    db.financeSourceReview.findMany({
      where: { companyId, sourceModule: "PROCUREMENT", status: { in: ["NO_EXPENSE", "EXPENSE_CREATED"] } },
      select: { sourceDocumentId: true, status: true },
    }),
  ])
  const ids = new Set<string>()
  for (const l of linked) if (l.sourceDocumentId) ids.add(l.sourceDocumentId)
  for (const r of reviews) {
    if (reviewBlocksCreate(r.status as FinanceSourceReviewStatus)) ids.add(r.sourceDocumentId)
  }
  return [...ids]
}

async function listPendingTransportSources(
  db: PrismaClient,
  companyId: string,
  branchIds: string[] | null
): Promise<TransportCostSource[]> {
  const excludeIds = await loadClosedTransportSourceIds(db, companyId)
  const sources = await listTransportCostSources(db, {
    companyId: companyId,
    branchIds,
    excludeIds,
  })
  if (sources.length === 0) return []

  const ids = sources.map((s) => s.sourceId)
  const [linked, reviews] = await Promise.all([
    db.expenseLine.findMany({
      where: {
        companyId: companyId,
        sourceModule: "TRANSPORT",
        sourceDocumentId: { in: ids },
        sourceLinkActive: true,
        expense: { deletedAt: null },
      },
      select: { sourceType: true, sourceDocumentId: true },
    }),
    db.financeSourceReview.findMany({
      where: {
        companyId: companyId,
        sourceModule: "TRANSPORT",
        sourceDocumentId: { in: ids },
        status: { in: ["NO_EXPENSE", "EXPENSE_CREATED"] },
      },
      select: { sourceType: true, sourceDocumentId: true, sourceLineId: true, status: true },
    }),
  ])

  const linkedSet = new Set(
    linked
      .filter((l) => l.sourceType && l.sourceDocumentId)
      .map((l) => sourceKey(l.sourceType as string, l.sourceDocumentId as string))
  )
  const closedReviewSet = new Set(
    reviews
      .filter((r) => reviewBlocksCreate(r.status as FinanceSourceReviewStatus))
      .map((r) => sourceReviewDocKey({ sourceType: r.sourceType, sourceDocumentId: r.sourceDocumentId }))
  )

  const pending = sources.filter((s) => {
    if (linkedSet.has(sourceKey(s.sourceType, s.sourceId))) return false
    return !closedReviewSet.has(
      sourceReviewDocKey({ sourceType: s.sourceType, sourceDocumentId: s.sourceId })
    )
  })
  return pending
}

export type SourceIdentity = {
  sourceModule: string
  sourceType: string | null
  sourceDocumentId: string
  sourceLineId: string | null
}

/**
 * A purchase order is billed as a whole: its lines may only live on one bill and
 * a review on the order closes every line, so checks ignore `sourceLineId`.
 */
function isDocumentLevelSource(identity: SourceIdentity): boolean {
  return identity.sourceModule === "PROCUREMENT"
}

function lineFilter(identity: SourceIdentity) {
  return isDocumentLevelSource(identity) ? {} : { sourceLineId: identity.sourceLineId }
}

async function loadReviews(
  db: PrismaClient,
  companyId: string,
  identity: SourceIdentity
): Promise<Array<{ status: string; sourceLineId: string | null }>> {
  const where = {
    companyId,
    sourceModule: identity.sourceModule as never,
    sourceType: identity.sourceType as string,
    sourceDocumentId: identity.sourceDocumentId,
  }
  const select = { status: true, sourceLineId: true } as const
  if (isDocumentLevelSource(identity)) return db.financeSourceReview.findMany({ where, select })
  const one = await db.financeSourceReview.findFirst({
    where: { ...where, sourceLineId: identity.sourceLineId },
    select,
  })
  return one ? [{ status: one.status, sourceLineId: one.sourceLineId ?? identity.sourceLineId }] : []
}

/** Guard used before writing linked lines to give a friendly error before the DB unique kicks in. */
export async function assertSourceLinesNotLinked(
  db: PrismaClient,
  params: { companyId: string; identities: SourceIdentity[]; ignoreExpenseId?: string }
) {
  const active = params.identities.filter((i) => i.sourceDocumentId)
  if (active.length === 0) return
  for (const identity of active) {
    const existing = await db.expenseLine.findFirst({
      where: {
        companyId: params.companyId,
        sourceModule: identity.sourceModule as never,
        sourceType: identity.sourceType,
        sourceDocumentId: identity.sourceDocumentId,
        ...lineFilter(identity),
        sourceLinkActive: true,
        expense: {
          deletedAt: null,
          ...(params.ignoreExpenseId ? { id: { not: params.ignoreExpenseId } } : {}),
        },
      },
      select: { id: true },
    })
    if (existing) throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")
  }
  await assertSourceReviewsAllowCreate(db, {
    companyId: params.companyId,
    identities: active,
    allowExpenseCreated: Boolean(params.ignoreExpenseId),
  })
}

async function assertSourceReviewsAllowCreate(
  db: PrismaClient,
  params: { companyId: string; identities: SourceIdentity[]; allowExpenseCreated?: boolean }
) {
  for (const identity of params.identities) {
    if (!identity.sourceType) continue
    const reviews = await loadReviews(db, params.companyId, identity)
    if (reviews.some((r) => r.status === "NO_EXPENSE")) {
      throw new ValidationError("เอกสารต้นทางนี้ถูกปิดว่าไม่มีค่าใช้จ่าย")
    }
    if (reviews.some((r) => r.status === "EXPENSE_CREATED") && !params.allowExpenseCreated) {
      throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")
    }
  }
}

export type ResolvedSource = {
  amount: number | null
  branchId: string
  paymentMethod: "cash" | "credit" | null
  description: string | null
  vehicleId: string
  vehicleLabel: string
}

/**
 * Load TRANSPORT source rows for linked lines. Keyed by `${sourceType}::${sourceDocumentId}`.
 * `amount` is the operational reference. The expense stores the amount finance confirms.
 */
export async function resolveTransportSources(
  db: PrismaClient,
  params: { companyId: string; identities: { sourceType: string; sourceDocumentId: string }[] }
): Promise<Map<string, ResolvedSource>> {
  const repairIds: string[] = []
  const tireIds: string[] = []
  const jobIds: string[] = []
  for (const i of params.identities) {
    if (i.sourceType === "TRANSPORT_REPAIR") repairIds.push(i.sourceDocumentId)
    else if (i.sourceType === "TRANSPORT_TIRE") tireIds.push(i.sourceDocumentId)
    else if (i.sourceType === "TRANSPORT_JOB") jobIds.push(i.sourceDocumentId)
  }
  const rows = await getTransportCostSourcesByIds(db, {
    companyId: params.companyId,
    repairIds,
    tireIds,
    jobIds,
  })
  const map = new Map<string, ResolvedSource>()
  for (const r of rows) {
    map.set(sourceKey(r.sourceType, r.sourceId), {
      amount: r.amount,
      branchId: r.branchId,
      paymentMethod: r.paymentMethod,
      description: r.description,
      vehicleId: r.vehicleId,
      vehicleLabel: r.vehicleLabel,
    })
  }
  return map
}

const TRANSPORT_SOURCE_TYPES = ["TRANSPORT_REPAIR", "TRANSPORT_TIRE", "TRANSPORT_JOB"] as const
export const PROCUREMENT_SOURCE_TYPE = "PURCHASE_ORDER"

export type ResolvedProcurementSource = {
  branchId: string
  supplierId: string | null
  lineIds: Set<string>
}

/** RECEIVED purchase orders keyed by order id. Missing = not billable. */
export async function resolveProcurementSources(
  db: PrismaClient,
  params: { companyId: string; ids: string[] }
): Promise<Map<string, ResolvedProcurementSource>> {
  const rows = await getProcurementCostSourcesByIds(db, { companyId: params.companyId, ids: [...new Set(params.ids)] })
  return new Map(
    rows.map((r) => [
      r.sourceId,
      { branchId: r.branchId, supplierId: r.supplierId, lineIds: new Set(r.lines.map((l) => l.id)) },
    ])
  )
}

async function findReview(
  db: PrismaClient,
  params: { companyId: string; identity: SourceIdentity }
) {
  if (!params.identity.sourceType) return null
  return db.financeSourceReview.findFirst({
    where: {
      companyId: params.companyId,
      sourceModule: params.identity.sourceModule as never,
      sourceType: params.identity.sourceType,
      sourceDocumentId: params.identity.sourceDocumentId,
      sourceLineId: params.identity.sourceLineId,
    },
  })
}

export async function upsertSourceReview(
  db: PrismaClient,
  params: {
    companyId: string
    identity: SourceIdentity
    status: FinanceSourceReviewStatus
    reason?: string | null
    userId?: string | null
  }
) {
  if (!params.identity.sourceType) return
  const existing = await findReview(db, { companyId: params.companyId, identity: params.identity })
  const data = {
    status: params.status,
    reason: params.reason ?? null,
    reviewedById: params.userId ?? null,
    reviewedAt: new Date(),
  }
  if (existing) {
    return db.financeSourceReview.update({ where: { id: existing.id }, data })
  }
  return db.financeSourceReview.create({
    data: {
      companyId: params.companyId,
      sourceModule: params.identity.sourceModule as never,
      sourceType: params.identity.sourceType,
      sourceDocumentId: params.identity.sourceDocumentId,
      sourceLineId: params.identity.sourceLineId,
      ...data,
    },
  })
}

export async function markReviewsExpenseCreated(
  db: PrismaClient,
  params: { companyId: string; identities: SourceIdentity[]; userId?: string | null }
) {
  for (const identity of params.identities) {
    if (!identity.sourceDocumentId || !identity.sourceType) continue
    await upsertSourceReview(db, {
      companyId: params.companyId,
      identity,
      status: "EXPENSE_CREATED",
      userId: params.userId,
    })
  }
}

/** Reopen EXPENSE_CREATED → PENDING for identities on the cancelled bill only. Never touches NO_EXPENSE. */
export async function reopenReviewsOnExpenseCancel(
  db: PrismaClient,
  params: { companyId: string; identities: SourceIdentity[]; userId?: string | null }
) {
  for (const identity of params.identities) {
    if (!identity.sourceDocumentId || !identity.sourceType) continue
    const existing = await findReview(db, { companyId: params.companyId, identity })
    if (!existing || !shouldReopenReviewOnExpenseCancel(existing.status as FinanceSourceReviewStatus)) {
      continue
    }
    await db.financeSourceReview.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        reason: null,
        reviewedById: params.userId ?? existing.reviewedById,
        reviewedAt: new Date(),
      },
    })
  }
}

/** Purchase order behind PROCUREMENT bill lines, for read-only photos and line detail on the bill. */
export async function getPurchaseOrderSource(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; id: string }
) {
  if (!canExpensesRead(params.roles)) throw new ForbiddenError()
  const [row] = await getProcurementCostSourcesByIds(db, { companyId: params.companyId, ids: [params.id] })
  if (!row) throw new NotFoundError("ไม่พบใบสั่งซื้อ")
  return { data: row }
}

export type SourceFinanceState = {
  state: "PENDING" | "EXPENSE_CREATED" | "NO_EXPENSE"
  expenseId: string | null
  expenseNo: string | null
  reason: string | null
}

/**
 * Read-only finance outcome per source document, for the owning module's UI.
 * Missing id in the map = still PENDING in the review queue.
 */
export async function getSourceFinanceStates(
  db: PrismaClient,
  params: { companyId: string; sourceModule: "TRANSPORT" | "PROCUREMENT"; sourceType: string; ids: string[] }
): Promise<Map<string, SourceFinanceState>> {
  const out = new Map<string, SourceFinanceState>()
  if (params.ids.length === 0) return out
  const [linked, reviews] = await Promise.all([
    db.expenseLine.findMany({
      where: {
        companyId: params.companyId,
        sourceModule: params.sourceModule,
        sourceType: params.sourceType,
        sourceDocumentId: { in: params.ids },
        sourceLinkActive: true,
        expense: { deletedAt: null, status: { not: "CANCELLED" } },
      },
      select: { sourceDocumentId: true, expense: { select: { id: true, expenseNo: true } } },
    }),
    db.financeSourceReview.findMany({
      where: {
        companyId: params.companyId,
        sourceModule: params.sourceModule,
        sourceType: params.sourceType,
        sourceDocumentId: { in: params.ids },
        status: "NO_EXPENSE",
      },
      select: { sourceDocumentId: true, reason: true },
    }),
  ])
  for (const r of reviews) {
    out.set(r.sourceDocumentId, { state: "NO_EXPENSE", expenseId: null, expenseNo: null, reason: r.reason })
  }
  for (const l of linked) {
    if (!l.sourceDocumentId) continue
    out.set(l.sourceDocumentId, {
      state: "EXPENSE_CREATED",
      expenseId: l.expense.id,
      expenseNo: l.expense.expenseNo,
      reason: null,
    })
  }
  return out
}

export async function markSourceNoExpense(
  db: PrismaClient,
  params: {
    companyId: string
    roles: UserRole[]
    userId: string
    input: { sourceType: string; sourceDocumentId: string; sourceLineId?: string | null; reason?: string | null }
  }
) {
  if (!canExpensesWrite(params.roles)) throw new ForbiddenError()

  const sourceType = params.input.sourceType
  const isProcurement = sourceType === PROCUREMENT_SOURCE_TYPE
  if (!isProcurement && !TRANSPORT_SOURCE_TYPES.includes(sourceType as (typeof TRANSPORT_SOURCE_TYPES)[number])) {
    throw new ValidationError("ประเภทต้นทางไม่ถูกต้อง")
  }
  const sourceDocumentId = params.input.sourceDocumentId?.trim()
  if (!sourceDocumentId) throw new ValidationError("ต้องระบุเอกสารต้นทาง")

  const identity: SourceIdentity = {
    sourceModule: isProcurement ? "PROCUREMENT" : "TRANSPORT",
    sourceType,
    sourceDocumentId,
    sourceLineId: isProcurement ? null : (params.input.sourceLineId ?? null),
  }

  const found = isProcurement
    ? (await resolveProcurementSources(db, { companyId: params.companyId, ids: [sourceDocumentId] })).has(
        sourceDocumentId
      )
    : (
        await resolveTransportSources(db, {
          companyId: params.companyId,
          identities: [{ sourceType, sourceDocumentId }],
        })
      ).has(sourceKey(sourceType, sourceDocumentId))
  if (!found) throw new ValidationError("ไม่พบเอกสารต้นทาง หรือถูกแก้ไข/ผูกไปแล้ว")

  const linked = await db.expenseLine.findFirst({
    where: {
      companyId: params.companyId,
      sourceModule: identity.sourceModule as never,
      sourceType,
      sourceDocumentId,
      ...lineFilter(identity),
      sourceLinkActive: true,
      expense: { deletedAt: null },
    },
    select: { id: true },
  })
  if (linked) throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")

  const existingReviews = await loadReviews(db, params.companyId, identity)
  if (existingReviews.some((r) => r.status === "EXPENSE_CREATED")) {
    throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")
  }
  if (existingReviews.some((r) => r.status === "NO_EXPENSE" && r.sourceLineId === identity.sourceLineId)) {
    return { data: { status: "NO_EXPENSE" as const, sourceType, sourceDocumentId } }
  }

  await upsertSourceReview(db, {
    companyId: params.companyId,
    identity,
    status: "NO_EXPENSE",
    reason: params.input.reason?.trim() || null,
    userId: params.userId,
  })

  return { data: { status: "NO_EXPENSE" as const, sourceType, sourceDocumentId } }
}
