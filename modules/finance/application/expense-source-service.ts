import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import {
  getTransportCostSourcesByIds,
  listTransportCostSources,
  type TransportCostSource,
} from "@/modules/transport"
import {
  reviewBlocksCreate,
  shouldReopenReviewOnExpenseCancel,
  sourceReviewKey,
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
 * while a document maps to a single amount (transport today). `groupKey` lets the
 * UI group many selectable rows under one heading.
 */
export type ExpenseSourceDto = TransportCostSource & {
  sourceKind: "IMPORT"
  sourceModule: "TRANSPORT"
  sourceDocumentId: string
  sourceLineId: string | null
  suggestedCostObjectType: "VEHICLE" | "JOB"
  groupKey: string
  groupLabel: string
  reviewStatus: "PENDING"
}

const GROUP_LABELS: Record<string, string> = {
  TRANSPORT: "ขนส่ง",
}

function sourceKey(sourceType: string, sourceDocumentId: string): string {
  return `${sourceType}::${sourceDocumentId}`
}

function toSourceDto(s: TransportCostSource): ExpenseSourceDto {
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
  }
}

/**
 * List finance-ready operational sources that still need review.
 * Excludes active Expense links and reviews in NO_EXPENSE / EXPENSE_CREATED.
 * Missing review row = PENDING.
 */
export async function listUnlinkedExpenseSources(
  db: PrismaClient,
  params: { companyId: string; roles: UserRole[]; branchId?: string | null }
) {
  if (!canExpensesRead(params.roles)) throw new ForbiddenError()

  const isAdmin = isAdminInAnyBranch(params.roles)
  let branchIds: string[] | null = isAdmin ? null : getBranchIds(params.roles)
  if (params.branchId) {
    if (!isAdmin && !getBranchIds(params.roles).includes(params.branchId)) {
      return { data: [] as ExpenseSourceDto[] }
    }
    branchIds = [params.branchId]
  }

  const sources = await listTransportCostSources(db, { companyId: params.companyId, branchIds })
  if (sources.length === 0) return { data: [] as ExpenseSourceDto[] }

  const ids = sources.map((s) => s.sourceId)
  const [linked, reviews] = await Promise.all([
    db.expenseLine.findMany({
      where: {
        companyId: params.companyId,
        sourceModule: "TRANSPORT",
        sourceDocumentId: { in: ids },
        sourceLinkActive: true,
        expense: { deletedAt: null },
      },
      select: { sourceType: true, sourceDocumentId: true },
    }),
    db.financeSourceReview.findMany({
      where: {
        companyId: params.companyId,
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
      .map((r) => sourceReviewKey({ sourceType: r.sourceType, sourceDocumentId: r.sourceDocumentId, sourceLineId: r.sourceLineId }))
  )

  return {
    data: sources
      .filter((s) => {
        if (linkedSet.has(sourceKey(s.sourceType, s.sourceId))) return false
        return !closedReviewSet.has(
          sourceReviewKey({ sourceType: s.sourceType, sourceDocumentId: s.sourceId, sourceLineId: null })
        )
      })
      .map(toSourceDto),
  }
}

export type SourceIdentity = {
  sourceModule: string
  sourceType: string | null
  sourceDocumentId: string
  sourceLineId: string | null
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
        sourceLineId: identity.sourceLineId,
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
    const review = await db.financeSourceReview.findFirst({
      where: {
        companyId: params.companyId,
        sourceModule: identity.sourceModule as never,
        sourceType: identity.sourceType,
        sourceDocumentId: identity.sourceDocumentId,
        sourceLineId: identity.sourceLineId,
      },
      select: { status: true },
    })
    if (!review) continue
    if (review.status === "NO_EXPENSE") {
      throw new ValidationError("เอกสารต้นทางนี้ถูกปิดว่าไม่มีค่าใช้จ่าย")
    }
    if (review.status === "EXPENSE_CREATED" && !params.allowExpenseCreated) {
      throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")
    }
  }
}

export type ResolvedSource = {
  amount: number | null
  branchId: string
  paymentMethod: "cash" | "credit" | null
  description: string
  vehicleId: string
  vehicleLabel: string
}

/**
 * Re-derive authoritative amounts for TRANSPORT source lines from the transport
 * module. Returns a map keyed by `${sourceType}::${sourceDocumentId}`.
 * Null/0 amounts are present so Finance can enter the bill amount.
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
  if (!TRANSPORT_SOURCE_TYPES.includes(sourceType as (typeof TRANSPORT_SOURCE_TYPES)[number])) {
    throw new ValidationError("ประเภทต้นทางไม่ถูกต้อง")
  }
  const sourceDocumentId = params.input.sourceDocumentId?.trim()
  if (!sourceDocumentId) throw new ValidationError("ต้องระบุเอกสารต้นทาง")

  const identity: SourceIdentity = {
    sourceModule: "TRANSPORT",
    sourceType,
    sourceDocumentId,
    sourceLineId: params.input.sourceLineId ?? null,
  }

  const resolved = await resolveTransportSources(db, {
    companyId: params.companyId,
    identities: [{ sourceType, sourceDocumentId }],
  })
  if (!resolved.has(sourceKey(sourceType, sourceDocumentId))) {
    throw new ValidationError("ไม่พบเอกสารต้นทาง หรือถูกแก้ไข/ผูกไปแล้ว")
  }

  const linked = await db.expenseLine.findFirst({
    where: {
      companyId: params.companyId,
      sourceModule: "TRANSPORT",
      sourceType,
      sourceDocumentId,
      sourceLineId: identity.sourceLineId,
      sourceLinkActive: true,
      expense: { deletedAt: null },
    },
    select: { id: true },
  })
  if (linked) throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")

  const existing = await findReview(db, { companyId: params.companyId, identity })
  if (existing?.status === "NO_EXPENSE") {
    return { data: { status: "NO_EXPENSE" as const, sourceType, sourceDocumentId } }
  }
  if (existing?.status === "EXPENSE_CREATED") {
    throw new ValidationError("เอกสารต้นทางนี้ถูกผูกกับค่าใช้จ่ายแล้ว")
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
