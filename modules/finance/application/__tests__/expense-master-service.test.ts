import { describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import {
  EXPENSE_COST_TYPES,
  EXPENSE_DIRECTNESS,
  expenseCategorySchema,
  expenseTypeSchema,
  processSchema,
  updateExpenseCategory,
  updateProcess,
  _normalizeCostCenterMapsForTests as normalizeCostCenterMaps,
  _normalizeProcessMapsForTests as normalizeProcessMaps,
} from "@/modules/finance/application/expense-master-service"

const CID = "00000000-0000-0000-0000-0000000000cc"
const A = "11111111-1111-1111-1111-111111111111"
const B = "22222222-2222-2222-2222-222222222222"
const adminRoles: UserRole[] = [
  { branchId: "b1", branchName: "HQ", roleName: "Admin", permissions: null },
]

describe("cost-type / directness enums", () => {
  it("exposes the three cost types and two directness values", () => {
    expect(EXPENSE_COST_TYPES).toEqual(["FIXED", "VARIABLE", "MIXED"])
    expect(EXPENSE_DIRECTNESS).toEqual(["DIRECT", "INDIRECT"])
  })
})

describe("expenseTypeSchema", () => {
  it("accepts the extended payload with metadata and mapping arrays", () => {
    const ok = expenseTypeSchema.safeParse({
      name: "น้ำมันเชื้อเพลิง",
      subcategory: "Fuel",
      defaultCostType: "VARIABLE",
      defaultDirectness: "DIRECT",
      defaultGlLabel: "ค่าน้ำมันเชื้อเพลิง",
      requiresVendor: true,
      requiresVehicle: true,
      costCenters: [{ costCenterId: A, isDefault: true }],
      processes: [{ processId: B, isAllowed: true }],
    })
    expect(ok.success).toBe(true)
  })

  it("rejects an invalid cost type", () => {
    const bad = expenseTypeSchema.safeParse({ name: "x", defaultCostType: "WEEKLY" })
    expect(bad.success).toBe(false)
  })

  it("requires a name", () => {
    expect(expenseTypeSchema.safeParse({}).success).toBe(false)
  })
})

describe("expenseCategorySchema / processSchema", () => {
  it("category requires a name and accepts a parent + sequence", () => {
    expect(expenseCategorySchema.safeParse({ name: "บุคลากร", parentId: A, sequence: 3 }).success).toBe(true)
    expect(expenseCategorySchema.safeParse({}).success).toBe(false)
  })

  it("process requires a name", () => {
    expect(processSchema.safeParse({ name: "จัดส่ง" }).success).toBe(true)
    expect(processSchema.safeParse({ code: "PROC-X" }).success).toBe(false)
  })
})

describe("mapping invariants", () => {
  it("coerces isDefault => isAllowed", () => {
    const out = normalizeCostCenterMaps([{ costCenterId: A, isDefault: true, isAllowed: false }])
    expect(out[0]).toEqual({ costCenterId: A, isDefault: true, isAllowed: true })
  })

  it("rejects more than one default cost center", () => {
    expect(() =>
      normalizeCostCenterMaps([
        { costCenterId: A, isDefault: true },
        { costCenterId: B, isDefault: true },
      ])
    ).toThrow()
  })

  it("rejects more than one default process", () => {
    expect(() =>
      normalizeProcessMaps([
        { processId: A, isDefault: true },
        { processId: B, isDefault: true },
      ])
    ).toThrow()
  })

  it("rejects duplicate targets", () => {
    expect(() =>
      normalizeCostCenterMaps([{ costCenterId: A }, { costCenterId: A }])
    ).toThrow()
  })

  it("defaults isAllowed to true when omitted", () => {
    const out = normalizeProcessMaps([{ processId: A }])
    expect(out[0]).toEqual({ processId: A, isDefault: false, isAllowed: true })
  })
})

/** Minimal fake client covering only the calls the hierarchy guard path makes. */
function fakeCategoryClient(nodes: Record<string, { parentId: string | null }>) {
  return {
    expenseCategory: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        nodes[where.id] ? { id: where.id } : null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        nodes[where.id] ? { parentId: nodes[where.id].parentId } : null,
      update: async () => ({ id: A, code: "01", name: "x", parentId: null, isActive: true }),
    },
  } as unknown as PrismaClient
}

function fakeProcessClient(nodes: Record<string, { parentId: string | null }>) {
  return {
    process: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        nodes[where.id] ? { id: where.id } : null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        nodes[where.id] ? { parentId: nodes[where.id].parentId } : null,
      update: async () => ({ id: A, code: "P", name: "x", parentId: null, isActive: true }),
    },
  } as unknown as PrismaClient
}

describe("category hierarchy guard", () => {
  it("rejects setting a category as its own parent", async () => {
    const db = fakeCategoryClient({ [A]: { parentId: null } })
    await expect(
      updateExpenseCategory(db, { companyId: CID, roles: adminRoles, id: A, input: { parentId: A } })
    ).rejects.toThrow()
  })

  it("rejects assigning a node under its own descendant (cycle)", async () => {
    // A is root, B is child of A. Making A's parent = B would create a cycle.
    const db = fakeCategoryClient({ [A]: { parentId: null }, [B]: { parentId: A } })
    await expect(
      updateExpenseCategory(db, { companyId: CID, roles: adminRoles, id: A, input: { parentId: B } })
    ).rejects.toThrow()
  })
})

describe("process hierarchy guard", () => {
  it("rejects a self-parent", async () => {
    const db = fakeProcessClient({ [A]: { parentId: null } })
    await expect(
      updateProcess(db, { companyId: CID, roles: adminRoles, id: A, input: { parentId: A } })
    ).rejects.toThrow()
  })

  it("rejects a descendant cycle", async () => {
    const db = fakeProcessClient({ [A]: { parentId: null }, [B]: { parentId: A } })
    await expect(
      updateProcess(db, { companyId: CID, roles: adminRoles, id: A, input: { parentId: B } })
    ).rejects.toThrow()
  })
})
