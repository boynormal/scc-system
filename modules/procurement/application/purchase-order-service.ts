import { z } from "zod"
import { Prisma, type PrismaClient } from "@prisma/client"
import { NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import {
  assertPurchaseAnywhere,
  assertPurchaseInBranch,
  purchaseBranchScope,
  purchaseBranchWhere,
  type PurchaseAction,
} from "./po-access"
import {
  PURCHASE_COST_OBJECT_TYPES,
  PURCHASE_ORDER_STATUSES,
  assertTransition,
  formatPoNo,
  isEditableStatus,
  lineAmount,
  poNoPrefix,
  sumLines,
  type PurchaseAttachmentKindValue,
  type PurchaseCostObjectType,
  type PurchaseOrderStatusValue,
} from "./po-rules"

const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000"

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const purchaseLineInputSchema = z.object({
  description: z.string().trim().min(1, "ต้องระบุชื่อสินค้า").max(500),
  quantity: z.number().positive("จำนวนต้องมากกว่า 0").max(9_999_999),
  unitId: z.string().uuid().nullable().optional(),
  unitPrice: z.number().min(0).max(999_999_999),
  costObjectType: z.enum(PURCHASE_COST_OBJECT_TYPES).nullable().optional(),
  costObjectLabel: z.string().trim().max(255).nullable().optional(),
})
export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>

const headerShape = {
  branchId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  orderDate: z.string().min(10),
  neededDate: z.string().min(10).nullable().optional(),
  requesterId: z.string().uuid().optional(),
  notes: z.string().max(4000).nullable().optional(),
}

export const createPurchaseOrderSchema = z.object({
  ...headerShape,
  lines: z.array(purchaseLineInputSchema).max(200).default([]),
})
export const updatePurchaseOrderSchema = z
  .object({ ...headerShape, lines: z.array(purchaseLineInputSchema).max(200) })
  .partial()
export const transitionPurchaseOrderSchema = z.object({
  to: z.enum(PURCHASE_ORDER_STATUSES),
  reason: z.string().trim().max(500).nullable().optional(),
})

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>
export type TransitionPurchaseOrderInput = z.infer<typeof transitionPurchaseOrderSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDateOnly(value: string): Date {
  const d = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (!Number.isFinite(d.getTime())) throw new ValidationError("วันที่ไม่ถูกต้อง")
  return d
}

const RECEIVED_LOOKBACK_DAYS = 15

function bangkokYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** A received-date search is active only when the caller sent at least one real date. */
export function receivedRangeRequested(from?: string | null, to?: string | null): boolean {
  return Boolean((from && YMD.test(from)) || (to && YMD.test(to)))
}

/** Inclusive received-date window. Missing ends fall back to the last 15 Bangkok days. */
export function receivedDateWindow(from: string | null | undefined, to: string | null | undefined, now = new Date()) {
  const today = bangkokYmd(now)
  const anchor = new Date(`${today}T12:00:00+07:00`)
  const defaultFrom = bangkokYmd(new Date(anchor.getTime() - RECEIVED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000))
  let startYmd = from && YMD.test(from) ? from : defaultFrom
  let endYmd = to && YMD.test(to) ? to : today
  if (startYmd > endYmd) [startYmd, endYmd] = [endYmd, startYmd]
  return {
    from: startYmd,
    to: endYmd,
    start: new Date(`${startYmd}T00:00:00+07:00`),
    end: new Date(`${endYmd}T23:59:59.999+07:00`),
  }
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function fullName(u: { firstName: string; lastName: string } | null | undefined): string | null {
  if (!u) return null
  return `${u.firstName} ${u.lastName}`.trim()
}

export function purchaseAttachmentFilePath(poId: string, attachmentId: string): string {
  return `/api/procurement/purchase-orders/${poId}/attachments/${attachmentId}/file`
}

const userName = { select: { id: true, firstName: true, lastName: true } } as const

const poInclude = {
  branch: { select: { id: true, name: true } },
  supplier: { select: { id: true, code: true, name: true, phone: true } },
  requester: userName,
  creator: userName,
  lines: { orderBy: { lineNo: "asc" as const } },
  attachments: {
    where: { storedFile: { deletedAt: null } },
    orderBy: { createdAt: "asc" as const },
    include: { storedFile: { select: { originalName: true, contentType: true, sizeBytes: true } } },
  },
} satisfies Prisma.PurchaseOrderInclude

type PoRow = Prisma.PurchaseOrderGetPayload<{ include: typeof poInclude }>

function serializeAttachment(poId: string, a: PoRow["attachments"][number]) {
  return {
    id: a.id,
    kind: a.kind as PurchaseAttachmentKindValue,
    fileName: a.storedFile.originalName,
    contentType: a.storedFile.contentType,
    sizeBytes: a.storedFile.sizeBytes,
    url: purchaseAttachmentFilePath(poId, a.id),
    createdAt: a.createdAt.toISOString(),
  }
}

function serializePurchaseOrder(row: PoRow) {
  return {
    id: row.id,
    poNo: row.poNo,
    status: row.status as PurchaseOrderStatusValue,
    branchId: row.branchId,
    branchName: row.branch.name,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    supplierCode: row.supplier?.code ?? null,
    supplierPhone: row.supplier?.phone ?? null,
    orderDate: isoDate(row.orderDate),
    neededDate: row.neededDate ? isoDate(row.neededDate) : null,
    orderedAt: row.orderedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    requesterId: row.requesterId,
    requesterName: fullName(row.requester),
    createdById: row.createdById,
    createdByName: fullName(row.creator),
    notes: row.notes,
    estimatedTotal: Number(row.estimatedTotal),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines.map((l) => ({
      id: l.id,
      lineNo: l.lineNo,
      description: l.description,
      quantity: Number(l.quantity),
      unitId: l.unitId,
      unitCode: l.unitCode,
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      costObjectType: l.costObjectType as PurchaseCostObjectType | null,
      costObjectLabel: l.costObjectLabel,
    })),
    attachments: row.attachments.map((a) => serializeAttachment(row.id, a)),
  }
}

export type PurchaseOrderDto = ReturnType<typeof serializePurchaseOrder>

type ResolvedLine = {
  lineNo: number
  description: string
  quantity: number
  unitId: string | null
  unitCode: string | null
  unitPrice: number
  amount: number
  costObjectType: string | null
  costObjectLabel: string | null
}

async function resolveLines(db: PrismaClient, companyId: string, inputs: PurchaseLineInput[]): Promise<ResolvedLine[]> {
  const unitIds = [...new Set(inputs.map((l) => l.unitId).filter((id): id is string => !!id))]
  const units = unitIds.length
    ? await db.unit.findMany({ where: { companyId, id: { in: unitIds } }, select: { id: true, code: true } })
    : []
  const codeById = new Map(units.map((u) => [u.id, u.code]))
  return inputs.map((input, index) => {
    const lineNo = index + 1
    const unitId = input.unitId ?? null
    if (unitId && !codeById.has(unitId)) throw new ValidationError(`บรรทัดที่ ${lineNo}: หน่วยไม่ถูกต้อง`)
    const type = input.costObjectType && input.costObjectType !== "GENERAL" ? input.costObjectType : null
    return {
      lineNo,
      description: input.description.trim(),
      quantity: input.quantity,
      unitId,
      unitCode: unitId ? (codeById.get(unitId) ?? null) : null,
      unitPrice: input.unitPrice,
      amount: lineAmount(input.quantity, input.unitPrice),
      costObjectType: type,
      costObjectLabel: type ? input.costObjectLabel?.trim() || null : null,
    }
  })
}

async function assertSupplier(db: PrismaClient, companyId: string, supplierId: string) {
  const s = await db.supplier.findFirst({ where: { id: supplierId, companyId }, select: { id: true } })
  if (!s) throw new ValidationError("ผู้ขายไม่ถูกต้อง")
}

async function assertBranch(db: PrismaClient, companyId: string, branchId: string) {
  const b = await db.branch.findFirst({
    where: { id: branchId, companyId, deletedAt: null, isActive: true },
    select: { id: true },
  })
  if (!b) throw new ValidationError("สาขาไม่ถูกต้อง")
}

async function assertRequester(db: PrismaClient, companyId: string, userId: string) {
  const u = await db.user.findFirst({ where: { id: userId, companyId, deletedAt: null }, select: { id: true } })
  if (!u) throw new ValidationError("ผู้ขอซื้อไม่ถูกต้อง")
}

async function writeAudit(
  db: { auditLog: { create: PrismaClient["auditLog"]["create"] } },
  params: {
    userId: string
    recordId: string
    action: "create" | "update" | "delete"
    event: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }
) {
  await db.auditLog.create({
    data: {
      userId: params.userId,
      tableName: "purchase_orders",
      recordId: params.recordId,
      action: params.action,
      oldValues: (params.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: { event: params.event, ...(params.newValues ?? {}) } as Prisma.InputJsonValue,
    },
  })
}

type Scope = { companyId: string; roles: UserRole[] }

async function findScoped(db: PrismaClient, params: Scope & { id: string }, action: PurchaseAction) {
  const row = await db.purchaseOrder.findFirst({
    where: {
      id: params.id,
      companyId: params.companyId,
      deletedAt: null,
      branchId: purchaseBranchWhere(params.roles, action),
    },
    include: poInclude,
  })
  if (!row) throw new NotFoundError("ไม่พบใบสั่งซื้อ")
  return row
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Purchase orders finance has already closed. Matches getSourceFinanceStates:
 * an active expense line on a live bill, or a NO_EXPENSE review. A cancelled
 * bill leaves no active line, so the order returns to the open queue.
 */
async function closedFinancePurchaseOrderIds(db: PrismaClient, companyId: string): Promise<string[]> {
  const [linked, reviews] = await Promise.all([
    db.expenseLine.findMany({
      where: {
        companyId,
        sourceModule: "PROCUREMENT",
        sourceType: "PURCHASE_ORDER",
        sourceLinkActive: true,
        sourceDocumentId: { not: null },
        expense: { deletedAt: null, status: { not: "CANCELLED" } },
      },
      select: { sourceDocumentId: true },
    }),
    db.financeSourceReview.findMany({
      where: {
        companyId,
        sourceModule: "PROCUREMENT",
        sourceType: "PURCHASE_ORDER",
        status: "NO_EXPENSE",
      },
      select: { sourceDocumentId: true },
    }),
  ])
  const ids = new Set<string>()
  for (const row of linked) if (row.sourceDocumentId) ids.add(row.sourceDocumentId)
  for (const row of reviews) ids.add(row.sourceDocumentId)
  return [...ids]
}

function openReceivedWhere(
  base: Prisma.PurchaseOrderWhereInput,
  closedIds: string[]
): Prisma.PurchaseOrderWhereInput {
  return {
    ...base,
    status: "RECEIVED",
    ...(closedIds.length > 0 ? { id: { notIn: closedIds } } : {}),
  }
}

export async function listPurchaseOrders(
  db: PrismaClient,
  params: Scope & {
    branchId?: string | null
    status?: string | null
    supplierId?: string | null
    search?: string | null
    receivedFrom?: string | null
    receivedTo?: string | null
  }
) {
  assertPurchaseAnywhere(params.roles, "read")
  const base: Prisma.PurchaseOrderWhereInput = {
    companyId: params.companyId,
    deletedAt: null,
    branchId: purchaseBranchWhere(params.roles, "read", params.branchId || null),
  }
  const supplierId = z.string().uuid().safeParse(params.supplierId ?? "")
  if (supplierId.success) base.supplierId = supplierId.data
  const q = params.search?.trim()
  if (q) {
    base.OR = [
      { poNo: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { lines: { some: { description: { contains: q, mode: "insensitive" } } } },
    ]
  }
  const status = (PURCHASE_ORDER_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as PurchaseOrderStatusValue)
    : null
  const useReceivedDates = status === "RECEIVED" && receivedRangeRequested(params.receivedFrom, params.receivedTo)
  const receivedWindow = useReceivedDates ? receivedDateWindow(params.receivedFrom, params.receivedTo) : null
  const closedIds = receivedWindow ? [] : await closedFinancePurchaseOrderIds(db, params.companyId)
  const openWhere = openReceivedWhere(base, closedIds)
  const receivedWhere: Prisma.PurchaseOrderWhereInput = receivedWindow
    ? { ...base, status: "RECEIVED", receivedAt: { gte: receivedWindow.start, lte: receivedWindow.end } }
    : openWhere
  const listWhere: Prisma.PurchaseOrderWhereInput =
    status === "RECEIVED" ? receivedWhere : status ? { ...base, status } : base

  const [rows, grouped, receivedCount] = await Promise.all([
    db.purchaseOrder.findMany({
      where: listWhere,
      include: poInclude,
      orderBy: status === "RECEIVED" ? [{ receivedAt: "desc" }, { createdAt: "desc" }] : [{ orderDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    db.purchaseOrder.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    db.purchaseOrder.count({ where: status === "RECEIVED" ? receivedWhere : openWhere }),
  ])
  const counts = Object.fromEntries(PURCHASE_ORDER_STATUSES.map((s) => [s, 0])) as Record<
    PurchaseOrderStatusValue,
    number
  >
  for (const g of grouped) counts[g.status as PurchaseOrderStatusValue] = g._count._all
  counts.RECEIVED = receivedCount
  return { data: rows.map(serializePurchaseOrder), counts }
}

export async function getPurchaseOrder(db: PrismaClient, params: Scope & { id: string }) {
  assertPurchaseAnywhere(params.roles, "read")
  const row = await findScoped(db, params, "read")
  return { data: serializePurchaseOrder(row) }
}

export async function getPurchaseOrderOptions(db: PrismaClient, params: Scope & { userId: string }) {
  assertPurchaseAnywhere(params.roles, "read")
  const readScope = purchaseBranchScope(params.roles, "read")
  const createScope = purchaseBranchScope(params.roles, "create")
  const [branches, suppliers, units, users] = await Promise.all([
    db.branch.findMany({
      where: {
        companyId: params.companyId,
        deletedAt: null,
        isActive: true,
        ...(readScope ? { id: { in: readScope.length ? readScope : [NO_MATCH_ID] } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.supplier.findMany({
      where: { companyId: params.companyId, isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.unit.findMany({
      where: { companyId: params.companyId, isActive: true },
      select: { id: true, code: true, name: true },
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
      createBranchIds: branches.filter((b) => !createScope || createScope.includes(b.id)).map((b) => b.id),
      suppliers,
      units,
      users: users.map((u) => ({ id: u.id, name: fullName(u) as string })),
      currentUserId: params.userId,
    },
  }
}

// ─── Mutations ───────────────────────────────────────────────────────────────

function toLineCreate(l: ResolvedLine): Prisma.PurchaseOrderLineCreateWithoutPurchaseOrderInput {
  return {
    lineNo: l.lineNo,
    description: l.description,
    quantity: l.quantity,
    unitCode: l.unitCode,
    unitPrice: l.unitPrice,
    amount: l.amount,
    costObjectType: l.costObjectType,
    costObjectLabel: l.costObjectLabel,
    ...(l.unitId ? { unit: { connect: { id: l.unitId } } } : {}),
  }
}

export async function createPurchaseOrder(
  db: PrismaClient,
  params: Scope & { userId: string; input: CreatePurchaseOrderInput; now?: Date }
) {
  const { input } = params
  assertPurchaseInBranch(params.roles, input.branchId, "create")
  await assertBranch(db, params.companyId, input.branchId)
  if (input.supplierId) await assertSupplier(db, params.companyId, input.supplierId)
  const requesterId = input.requesterId ?? params.userId
  if (requesterId !== params.userId) await assertRequester(db, params.companyId, requesterId)
  const lines = await resolveLines(db, params.companyId, input.lines ?? [])
  const now = params.now ?? new Date()
  const prefix = poNoPrefix(now)

  let row: PoRow | null = null
  for (let attempt = 0; attempt < 3 && !row; attempt += 1) {
    const count = await db.purchaseOrder.count({
      where: { companyId: params.companyId, poNo: { startsWith: prefix } },
    })
    try {
      row = await db.purchaseOrder.create({
        data: {
          companyId: params.companyId,
          branchId: input.branchId,
          poNo: formatPoNo(now, count + attempt),
          supplierId: input.supplierId ?? null,
          orderDate: parseDateOnly(input.orderDate),
          neededDate: input.neededDate ? parseDateOnly(input.neededDate) : null,
          requesterId,
          notes: input.notes?.trim() || null,
          estimatedTotal: sumLines(lines),
          createdById: params.userId,
          lines: { create: lines.map(toLineCreate) },
        },
        include: poInclude,
      })
    } catch (err) {
      const retry = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
      if (!retry || attempt === 2) throw err
    }
  }
  if (!row) throw new ValidationError("สร้างเลขที่ใบสั่งซื้อไม่สำเร็จ")
  await writeAudit(db, {
    userId: params.userId,
    recordId: row.id,
    action: "create",
    event: "PO_CREATE",
    newValues: { poNo: row.poNo, estimatedTotal: Number(row.estimatedTotal) },
  })
  return { data: serializePurchaseOrder(row) }
}

export async function updatePurchaseOrder(
  db: PrismaClient,
  params: Scope & { userId: string; id: string; input: UpdatePurchaseOrderInput }
) {
  const existing = await findScoped(db, params, "update")
  assertPurchaseInBranch(params.roles, existing.branchId, "update")
  if (!isEditableStatus(existing.status as PurchaseOrderStatusValue)) {
    throw new ValidationError("แก้ไขได้เฉพาะใบสั่งซื้อที่เป็นร่าง")
  }
  const { input } = params
  if (input.branchId && input.branchId !== existing.branchId) {
    assertPurchaseInBranch(params.roles, input.branchId, "update")
    await assertBranch(db, params.companyId, input.branchId)
  }
  if (input.supplierId) await assertSupplier(db, params.companyId, input.supplierId)
  if (input.requesterId) await assertRequester(db, params.companyId, input.requesterId)

  const data: Prisma.PurchaseOrderUpdateInput = {
    ...(input.branchId ? { branch: { connect: { id: input.branchId } } } : {}),
    ...(input.supplierId !== undefined
      ? input.supplierId
        ? { supplier: { connect: { id: input.supplierId } } }
        : { supplier: { disconnect: true } }
      : {}),
    ...(input.requesterId ? { requester: { connect: { id: input.requesterId } } } : {}),
    ...(input.orderDate ? { orderDate: parseDateOnly(input.orderDate) } : {}),
    ...(input.neededDate !== undefined
      ? { neededDate: input.neededDate ? parseDateOnly(input.neededDate) : null }
      : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  }

  if (input.lines) {
    const lines = await resolveLines(db, params.companyId, input.lines)
    await db.$transaction(async (tx) => {
      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: existing.id } })
      await tx.purchaseOrder.update({
        where: { id: existing.id },
        data: { ...data, estimatedTotal: sumLines(lines), lines: { create: lines.map(toLineCreate) } },
      })
    })
  } else {
    await db.purchaseOrder.update({ where: { id: existing.id }, data })
  }
  await writeAudit(db, { userId: params.userId, recordId: existing.id, action: "update", event: "PO_UPDATE" })
  return getPurchaseOrder(db, params)
}

export async function transitionPurchaseOrder(
  db: PrismaClient,
  params: Scope & {
    userId: string
    id: string
    input: TransitionPurchaseOrderInput
  }
) {
  const existing = await findScoped(db, params, "update")
  assertPurchaseInBranch(params.roles, existing.branchId, "update")
  const from = existing.status as PurchaseOrderStatusValue
  const to = params.input.to
  assertTransition({
    from,
    to,
    lineCount: existing.lines.length,
    reason: params.input.reason,
  })
  const now = new Date()
  const data: Prisma.PurchaseOrderUpdateManyMutationInput = { status: to }
  if (to === "ORDERED") data.orderedAt = now
  if (to === "DRAFT") data.orderedAt = null
  if (to === "RECEIVED") data.receivedAt = now
  if (to === "CANCELLED") {
    data.cancelledAt = now
    data.cancelReason = params.input.reason?.trim() ?? null
  }
  const updated = await db.purchaseOrder.updateMany({ where: { id: existing.id, status: from }, data })
  if (updated.count === 0) throw new ValidationError("สถานะถูกเปลี่ยนไปแล้ว กรุณาโหลดใหม่")
  await writeAudit(db, {
    userId: params.userId,
    recordId: existing.id,
    action: "update",
    event: "PO_STATUS",
    oldValues: { status: from },
    newValues: { status: to, ...(params.input.reason ? { reason: params.input.reason } : {}) },
  })
  return getPurchaseOrder(db, params)
}

export async function deletePurchaseOrder(db: PrismaClient, params: Scope & { userId: string; id: string }) {
  const existing = await findScoped(db, params, "delete")
  assertPurchaseInBranch(params.roles, existing.branchId, "delete")
  if (existing.status !== "DRAFT") throw new ValidationError("ลบได้เฉพาะใบสั่งซื้อที่เป็นร่าง ใบอื่นให้ยกเลิกแทน")
  await db.purchaseOrder.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })
  await writeAudit(db, { userId: params.userId, recordId: existing.id, action: "delete", event: "PO_DELETE" })
  return { data: { id: existing.id } }
}

/** Internal: load an order for file operations after the caller checked the action. */
export async function findPurchaseOrderForFile(
  db: PrismaClient,
  params: Scope & { id: string },
  action: PurchaseAction
) {
  const row = await findScoped(db, params, action)
  assertPurchaseInBranch(params.roles, row.branchId, action)
  return row
}
