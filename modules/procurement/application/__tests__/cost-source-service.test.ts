import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { getProcurementCostSourcesByIds, listProcurementCostSources } from "../cost-source-service"

function poRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    branchId: "b1",
    poNo: `PO-202611-${id}`,
    supplierId: "s1",
    supplier: { id: "s1", name: "ร้านอะไหล่" },
    estimatedTotal: 1150,
    receivedAt: new Date("2026-11-20T03:00:00.000Z"),
    updatedAt: new Date("2026-11-20T03:00:00.000Z"),
    lines: [
      { id: `${id}-l1`, description: "ผ้าเบรก", quantity: 2, unitId: "u1", unitCode: "SET", unitPrice: 500, amount: 1000, costObjectType: "VEHICLE", costObjectLabel: "70-1234" },
      { id: `${id}-l2`, description: "ค่าส่ง", quantity: 1, unitId: null, unitCode: null, unitPrice: 150, amount: 150, costObjectType: null, costObjectLabel: null },
    ],
    attachments: [
      { id: "a1", kind: "DELIVERY_NOTE", storedFile: { originalName: "bill.jpg", contentType: "image/jpeg" } },
    ],
    ...over,
  }
}

function mockDb(ids: string[]) {
  const findMany = vi.fn(async (args: { select?: unknown; where: { id?: { in: string[] } } }) => {
    if (args.select) return ids.map((id) => ({ id }))
    return (args.where.id?.in ?? []).map((id) => poRow(id))
  })
  return { db: { purchaseOrder: { findMany } } as unknown as PrismaClient, findMany }
}

describe("listProcurementCostSources", () => {
  it("only asks for RECEIVED, non-deleted orders in the allowed branches", async () => {
    const { db, findMany } = mockDb(["p1"])
    await listProcurementCostSources(db, { companyId: "c1", branchIds: ["b1"] })
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>
    expect(where).toMatchObject({ companyId: "c1", deletedAt: null, status: "RECEIVED", branchId: { in: ["b1"] } })
    const hydrate = findMany.mock.calls[1][0].where as Record<string, unknown>
    expect(hydrate).toMatchObject({ status: "RECEIVED", deletedAt: null })
  })

  it("leaves out orders Finance already closed", async () => {
    const { db } = mockDb(["p1", "p2", "p3"])
    const rows = await listProcurementCostSources(db, { companyId: "c1", branchIds: null, excludeIds: ["p2"] })
    expect(rows.map((r) => r.sourceId)).toEqual(["p1", "p3"])
  })

  it("matches no branch when the user has none", async () => {
    const { db, findMany } = mockDb([])
    await listProcurementCostSources(db, { companyId: "c1", branchIds: [] })
    const where = findMany.mock.calls[0][0].where as { branchId: { in: string[] } }
    expect(where.branchId.in).toEqual(["00000000-0000-0000-0000-000000000000"])
  })
})

describe("getProcurementCostSourcesByIds", () => {
  it("maps lines, supplier, and finance-side photo urls", async () => {
    const { db } = mockDb([])
    const [row] = await getProcurementCostSourcesByIds(db, { companyId: "c1", ids: ["p1"] })
    expect(row).toMatchObject({
      sourceType: "PURCHASE_ORDER",
      sourceId: "p1",
      documentNo: "PO-202611-p1",
      amount: 1150,
      supplierId: "s1",
      supplierName: "ร้านอะไหล่",
      description: "ผ้าเบรก และอีก 1 รายการ",
      date: "2026-11-20T03:00:00.000Z",
    })
    expect(row.lines.map((l) => l.id)).toEqual(["p1-l1", "p1-l2"])
    expect(row.attachments[0].url).toBe("/api/finance/expenses/sources/purchase-orders/p1/attachments/a1/file")
  })

  it("keeps a received order in the queue when it has no supplier", async () => {
    const findMany = vi.fn(async () => [poRow("p1", { supplierId: null, supplier: null })])
    const db = { purchaseOrder: { findMany } } as unknown as PrismaClient
    const [row] = await getProcurementCostSourcesByIds(db, { companyId: "c1", ids: ["p1"] })
    expect(row.supplierId).toBeNull()
    expect(row.supplierName).toBeNull()
    expect(row.sourceId).toBe("p1")
  })

  it("loads ids in chunks of 200", async () => {
    const { db, findMany } = mockDb([])
    const ids = Array.from({ length: 450 }, (_, i) => `p${i}`)
    const rows = await getProcurementCostSourcesByIds(db, { companyId: "c1", ids })
    expect(findMany).toHaveBeenCalledTimes(3)
    expect(rows).toHaveLength(450)
  })
})
