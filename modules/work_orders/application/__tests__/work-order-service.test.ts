import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { createWorkOrder, deleteWorkOrder, listWorkOrders, transitionWorkOrder, updateWorkOrder } from "@/modules/work_orders/application/work-order-service"

function adminRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Admin", permissions: null }
}

function managerRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Manager", permissions: null }
}

function viewerRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Viewer", permissions: null }
}

function createMockDb() {
  const db = {
    branch: { findFirst: vi.fn() },
    asset: { findFirst: vi.fn() },
    machine: { findFirst: vi.fn(), update: vi.fn() },
    workOrder: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), update: vi.fn() },
    workOrderTechnician: { deleteMany: vi.fn() },
    workOrderPart: { deleteMany: vi.fn() },
    workOrderStatusHistory: { create: vi.fn(), deleteMany: vi.fn() },
    checklistResult: { deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  }
  db.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof db) => Promise<unknown>)(db)
    return Promise.all(arg as Promise<unknown>[])
  })
  return db
}

type MockDb = ReturnType<typeof createMockDb>

function asDb(mockDb: MockDb): PrismaClient {
  return mockDb as unknown as PrismaClient
}

describe("listWorkOrders", () => {
  it("returns Forbidden when no role grants work_orders read in any branch", async () => {
    const db = createMockDb()

    const result = await listWorkOrders(asDb(db), {
      companyId: "company-1",
      roles: [viewerRole("branch-1")].map((r) => ({ ...r, permissions: { work_orders: [] } })),
      page: 1,
      pageSize: 20,
    })

    expect(result).toEqual({ error: "Forbidden", status: 403 })
    expect(db.workOrder.findMany).not.toHaveBeenCalled()
  })

  it("returns Forbidden when a non-admin requests a branchId they are not allowed to see", async () => {
    const db = createMockDb()

    const result = await listWorkOrders(asDb(db), {
      companyId: "company-1",
      roles: [viewerRole("branch-1")],
      branchId: "branch-2",
      page: 1,
      pageSize: 20,
    })

    expect(result).toEqual({ error: "Forbidden", status: 403 })
    expect(db.workOrder.findMany).not.toHaveBeenCalled()
  })

  it("returns 'Invalid branch' when an admin requests a branchId outside the company", async () => {
    const db = createMockDb()
    db.branch.findFirst.mockResolvedValue(null)

    const result = await listWorkOrders(asDb(db), {
      companyId: "company-1",
      roles: [adminRole("branch-1")],
      branchId: "branch-outside",
      page: 1,
      pageSize: 20,
    })

    expect(result).toEqual({ error: "Invalid branch", status: 400 })
    expect(db.workOrder.findMany).not.toHaveBeenCalled()
  })

  it("returns paginated data when the request is authorized", async () => {
    const db = createMockDb()
    db.workOrder.findMany.mockResolvedValue([{ id: "wo-1" }])
    db.workOrder.count.mockResolvedValue(1)

    const result = await listWorkOrders(asDb(db), {
      companyId: "company-1",
      roles: [viewerRole("branch-1")],
      page: 1,
      pageSize: 20,
    })

    expect(result).toEqual({ data: [{ id: "wo-1" }], total: 1, page: 1, pageSize: 20, totalPages: 1 })
  })
})

describe("createWorkOrder", () => {
  const assetInput = {
    assetId: "asset-1",
    typeId: "type-1",
    priority: "medium" as const,
    title: "Fix pump",
  }
  const generalInput = {
    typeId: "type-1",
    branchId: "branch-1",
    priority: "medium" as const,
    title: "ซ่อมไฟห้องประชุม",
  }
  function assetRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "asset-1",
      code: "AST-1",
      name: "Pump",
      branchId: "branch-1",
      status: "ACTIVE",
      isActive: true,
      deletedAt: null,
      maintenancePmEnabled: false,
      type: { name: "เครื่องจักร" },
      branch: { name: "HQ" },
      machine: { id: "machine-1", code: "M-1", name: "Pump", deletedAt: null },
      vehicle: null,
      ...overrides,
    }
  }

  it("returns 'Invalid branch' when the branch does not belong to the company", async () => {
    const db = createMockDb()
    db.branch.findFirst.mockResolvedValue(null)

    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [adminRole("branch-1")],
      input: generalInput,
    })

    expect(result).toEqual({ error: "Invalid branch", status: 400 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it("returns Forbidden when the role has no create permission for the branch", async () => {
    const db = createMockDb()
    db.branch.findFirst.mockResolvedValue({ id: "branch-1" })

    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [viewerRole("branch-1")],
      input: generalInput,
    })

    expect(result).toEqual({ error: "Forbidden", status: 403 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it("rejects an asset that is retired, disposed, inactive or missing", async () => {
    const db = createMockDb()
    db.asset.findFirst.mockResolvedValue(null)

    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [managerRole("branch-1")],
      input: assetInput,
    })

    expect(result).toMatchObject({ status: 400 })
    expect(db.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "asset-1",
          deletedAt: null,
          isActive: true,
          status: { notIn: ["RETIRED", "DISPOSED"] },
        }),
      })
    )
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it("rejects a request with neither an asset nor a branch", async () => {
    const db = createMockDb()

    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [managerRole("branch-1")],
      input: { typeId: "type-1", priority: "medium", title: "?" },
    })

    expect(result).toMatchObject({ status: 400 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it("repairs an asset that is not in maintenance PM; branch and machine come from the asset", async () => {
    const db = createMockDb()
    db.asset.findFirst.mockResolvedValue(assetRow())
    db.branch.findFirst.mockResolvedValue({ id: "branch-1" })
    db.workOrder.count.mockResolvedValue(0)
    db.workOrder.create.mockResolvedValue({ id: "wo-1" })

    const year = new Date().getFullYear()
    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [managerRole("branch-1")],
      input: assetInput,
    })

    expect(db.asset.findFirst.mock.calls[0][0].where).not.toHaveProperty("maintenancePmEnabled")
    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "open",
          woNumber: `WO-${year}-00001`,
          createdBy: "user-1",
          branchId: "branch-1",
          assetId: "asset-1",
          machineId: "machine-1",
        }),
      })
    )
    expect(result).toEqual({ data: { id: "wo-1" }, woNumber: `WO-${year}-00001`, warning: null })
  })

  it("creates a general repair with only a branch", async () => {
    const db = createMockDb()
    db.branch.findFirst.mockResolvedValue({ id: "branch-1" })
    db.workOrder.count.mockResolvedValue(0)
    db.workOrder.create.mockResolvedValue({ id: "wo-2" })

    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [managerRole("branch-1")],
      input: generalInput,
    })

    expect(db.asset.findFirst).not.toHaveBeenCalled()
    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ branchId: "branch-1", assetId: null, machineId: null }),
      })
    )
    expect(result).toMatchObject({ data: { id: "wo-2" }, warning: null })
  })
})

describe("deleteWorkOrder", () => {
  it("returns 404 when the work order is not found", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue(null)

    const result = await deleteWorkOrder(asDb(db), { id: "wo-1", companyId: "company-1", roles: [adminRole()] })

    expect(result).toMatchObject({ error: "Not found", status: 404 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("blocks deletion when transactions are already linked", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", _count: { transactions: 2 } })

    const result = await deleteWorkOrder(asDb(db), { id: "wo-1", companyId: "company-1", roles: [adminRole()] })

    expect(result).toEqual({ status: 400, error: { message: "ไม่สามารถลบใบสั่งงานที่มีการเบิกจ่ายอะไหล่แล้วได้" } })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("deletes dependent rows and the work order when there are no transactions", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", _count: { transactions: 0 } })

    const result = await deleteWorkOrder(asDb(db), { id: "wo-1", companyId: "company-1", roles: [adminRole()] })

    expect(db.$transaction).toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })

  it("returns Forbidden when the work order belongs to another branch", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-2", status: "open", _count: { transactions: 0 } })

    const result = await updateWorkOrder(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      roles: [managerRole("branch-1")],
      input: { title: "changed" },
    })

    expect(result).toMatchObject({ error: "Forbidden", status: 403 })
    expect(db.workOrder.update).not.toHaveBeenCalled()
  })
})

describe("transitionWorkOrder", () => {
  it("rejects a skip from open to closed and does not change the machine", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", status: "open", assignedTo: null })

    const result = await transitionWorkOrder(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      userId: "user-1",
      roles: [adminRole()],
      input: { toStatus: "closed" },
    })

    expect(result).toEqual({ error: "เปลี่ยนสถานะนี้ไม่ได้", status: 400 })
    expect(db.workOrder.update).not.toHaveBeenCalled()
    expect(db.machine.update).not.toHaveBeenCalled()
  })

  it("writes status history when moving open to assigned", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", status: "open", assignedTo: null })
    db.workOrder.update.mockResolvedValue({ id: "wo-1", status: "assigned" })

    const result = await transitionWorkOrder(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      userId: "user-1",
      roles: [managerRole()],
      input: { toStatus: "assigned", assignedTo: "55555555-5555-5555-5555-555555555555" },
    })

    expect(result).toEqual({ data: { id: "wo-1", status: "assigned" } })
    expect(db.workOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fromStatus: "open", toStatus: "assigned" }),
      })
    )
    expect(db.machine.update).not.toHaveBeenCalled()
  })
})
