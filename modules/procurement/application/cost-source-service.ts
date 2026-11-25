import type { Prisma, PrismaClient } from "@prisma/client"

export type ProcurementCostSourceType = "PURCHASE_ORDER"

export type ProcurementCostSourceLine = {
  /** Order line id; Finance stores it as `sourceLineId`. */
  id: string
  description: string
  quantity: number
  unitId: string | null
  unitCode: string | null
  unitPrice: number
  amount: number
  costObjectType: string | null
  costObjectLabel: string | null
}

export type ProcurementCostSourceAttachment = {
  id: string
  kind: string
  fileName: string
  contentType: string
  /** Finance-side URL; gated by `expenses:read`. */
  url: string
}

export type ProcurementCostSource = {
  sourceType: ProcurementCostSourceType
  /** Purchase order id. */
  sourceId: string
  branchId: string
  /** When the goods were received. */
  date: string
  /** Estimated total from the order. Reference only — Finance enters the real amount. */
  amount: number | null
  documentNo: string
  description: string | null
  supplierId: string | null
  supplierName: string | null
  lines: ProcurementCostSourceLine[]
  attachments: ProcurementCostSourceAttachment[]
}

const HYDRATE_CHUNK = 200

export function financePurchaseAttachmentPath(poId: string, attachmentId: string): string {
  return `/api/finance/expenses/sources/purchase-orders/${poId}/attachments/${attachmentId}/file`
}

const sourceInclude = {
  supplier: { select: { id: true, name: true } },
  lines: { orderBy: { lineNo: "asc" as const } },
  attachments: {
    where: { storedFile: { deletedAt: null } },
    orderBy: { createdAt: "asc" as const },
    include: { storedFile: { select: { originalName: true, contentType: true } } },
  },
} satisfies Prisma.PurchaseOrderInclude

type SourceRow = Prisma.PurchaseOrderGetPayload<{ include: typeof sourceInclude }>

export function mapPurchaseOrderSource(row: SourceRow): ProcurementCostSource {
  const first = row.lines[0]?.description
  const more = row.lines.length > 1 ? ` และอีก ${row.lines.length - 1} รายการ` : ""
  return {
    sourceType: "PURCHASE_ORDER",
    sourceId: row.id,
    branchId: row.branchId,
    date: (row.receivedAt ?? row.updatedAt).toISOString(),
    amount: Number(row.estimatedTotal),
    documentNo: row.poNo,
    description: first ? `${first}${more}`.slice(0, 255) : null,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    lines: row.lines.map((l) => ({
      id: l.id,
      description: l.description,
      quantity: Number(l.quantity),
      unitId: l.unitId,
      unitCode: l.unitCode,
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      costObjectType: l.costObjectType,
      costObjectLabel: l.costObjectLabel,
    })),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      fileName: a.storedFile.originalName,
      contentType: a.storedFile.contentType,
      url: financePurchaseAttachmentPath(row.id, a.id),
    })),
  }
}

function branchWhere(branchIds: string[] | null) {
  if (branchIds === null) return {}
  return { branchId: { in: branchIds.length ? branchIds : ["00000000-0000-0000-0000-000000000000"] } }
}

/** RECEIVED purchase orders not yet closed by Finance. */
export async function listProcurementCostSources(
  db: PrismaClient,
  params: { companyId: string; branchIds: string[] | null; excludeIds?: string[] }
): Promise<ProcurementCostSource[]> {
  const skip = new Set(params.excludeIds ?? [])
  const ids = (
    await db.purchaseOrder.findMany({
      where: { companyId: params.companyId, deletedAt: null, status: "RECEIVED", ...branchWhere(params.branchIds) },
      select: { id: true },
      orderBy: { receivedAt: "desc" },
    })
  )
    .map((r) => r.id)
    .filter((id) => !skip.has(id))
  return getProcurementCostSourcesByIds(db, { companyId: params.companyId, ids })
}

export async function getProcurementCostSourcesByIds(
  db: PrismaClient,
  params: { companyId: string; ids: string[] }
): Promise<ProcurementCostSource[]> {
  const out: ProcurementCostSource[] = []
  for (let i = 0; i < params.ids.length; i += HYDRATE_CHUNK) {
    const rows = await db.purchaseOrder.findMany({
      where: {
        companyId: params.companyId,
        deletedAt: null,
        status: "RECEIVED",
        id: { in: params.ids.slice(i, i + HYDRATE_CHUNK) },
      },
      include: sourceInclude,
      orderBy: { receivedAt: "desc" },
    })
    out.push(...rows.map(mapPurchaseOrderSource))
  }
  return out
}
