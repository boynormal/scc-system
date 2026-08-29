import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, ValidationError } from "@/lib/errors"
import { getBranchIds, hasPermission, isAdminInAnyBranch, type UserRole } from "@/lib/permissions"
import {
  getTransportCostSourcesByIds,
  listTransportCostSources,
  type TransportCostSource,
} from "@/modules/transport"

function canExpensesRead(roles: UserRole[]): boolean {
  return (
    isAdminInAnyBranch(roles) ||
    getBranchIds(roles).some((bid) => hasPermission(roles, bid, "expenses", "read"))
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
  suggestedCostObjectType: "VEHICLE"
  groupKey: string
  groupLabel: string
}

const GROUP_LABELS: Record<string, string> = {
  TRANSPORT: "ขนส่ง",
}

function sourceKey(sourceType: string, sourceDocumentId: string): string {
  return `${sourceType}::${sourceDocumentId}`
}

/**
 * List transport cost entries (repair/tire) that do not yet have a linked, active
 * ExpenseLine. Reference-only: reads transport data through the transport module's
 * application service, then filters out anything already turned into an expense line.
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
  const linked = await db.expenseLine.findMany({
    where: {
      companyId: params.companyId,
      sourceModule: "TRANSPORT",
      sourceDocumentId: { in: ids },
      sourceLinkActive: true,
      expense: { deletedAt: null },
    },
    select: { sourceType: true, sourceDocumentId: true },
  })
  const linkedSet = new Set(
    linked
      .filter((l) => l.sourceType && l.sourceDocumentId)
      .map((l) => sourceKey(l.sourceType as string, l.sourceDocumentId as string))
  )

  return {
    data: sources
      .filter((s) => !linkedSet.has(sourceKey(s.sourceType, s.sourceId)))
      .map<ExpenseSourceDto>((s) => ({
        ...s,
        sourceKind: "IMPORT",
        sourceModule: "TRANSPORT",
        sourceDocumentId: s.sourceId,
        sourceLineId: null,
        suggestedCostObjectType: "VEHICLE",
        groupKey: "TRANSPORT",
        groupLabel: GROUP_LABELS.TRANSPORT,
      })),
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
}

export type ResolvedSource = {
  amount: number
  branchId: string
  paymentMethod: "cash" | "credit" | null
  description: string
  vehicleId: string
  vehicleLabel: string
}

/**
 * Re-derive authoritative amounts for TRANSPORT source lines from the transport
 * module. Returns a map keyed by `${sourceType}::${sourceDocumentId}`. Any id not
 * present (deleted or zero cost) is absent, letting the caller reject stale links.
 */
export async function resolveTransportSources(
  db: PrismaClient,
  params: { companyId: string; identities: { sourceType: string; sourceDocumentId: string }[] }
): Promise<Map<string, ResolvedSource>> {
  const repairIds: string[] = []
  const tireIds: string[] = []
  for (const i of params.identities) {
    if (i.sourceType === "TRANSPORT_REPAIR") repairIds.push(i.sourceDocumentId)
    else if (i.sourceType === "TRANSPORT_TIRE") tireIds.push(i.sourceDocumentId)
  }
  const rows = await getTransportCostSourcesByIds(db, {
    companyId: params.companyId,
    repairIds,
    tireIds,
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
