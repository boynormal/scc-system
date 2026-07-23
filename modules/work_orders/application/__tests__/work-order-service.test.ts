import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { createWorkOrder, deleteWorkOrder, listWorkOrders } from "@/modules/work_orders/application/work-order-service"

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
  return {
    branch: { findFirst: vi.fn() },
    machine: { findFirst: vi.fn() },
    workOrder: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    workOrderTechnician: { deleteMany: vi.fn() },
    workOrderPart: { deleteMany: vi.fn() },
    checklistResult: { deleteMany: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    $executeRaw: vi.fn(),
  }
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
  const baseInput = {
    machineId: "machine-1",
    typeId: "type-1",
    branchId: "branch-1",
    priority: "medium" as const,
    title: "Fix pump",
  }

  it("returns 'Invalid branch' when the branch does not belong to the company", async () => {
    const db = createMockDb()
    db.branch.findFirst.mockResolvedValue(null)

    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [adminRole("branch-1")],
      input: baseInput,
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
      input: baseInput,
    })

    expect(result).toEqual({ error: "Forbidden", status: 403 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it("returns 'Invalid machine for branch' when the machine does not match branch/company", async () => {
    const db = createMockDb()
    db.branch.findFirst.mockResolvedValue({ id: "branch-1" })
    db.machine.findFirst.mockResolvedValue(null)

    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [managerRole("branch-1")],
      input: baseInput,
    })

    expect(result).toEqual({ error: "Invalid machine for branch", status: 400 })
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it("creates the work order with status 'open' and a generated woNumber on the happy path", async () => {
    const db = createMockDb()
    db.branch.findFirst.mockResolvedValue({ id: "branch-1" })
    db.machine.findFirst.mockResolvedValue({ id: "machine-1" })
    db.workOrder.count.mockResolvedValue(0)
    db.workOrder.create.mockResolvedValue({ id: "wo-1" })

    const year = new Date().getFullYear()
    const result = await createWorkOrder(asDb(db), {
      companyId: "company-1",
      userId: "user-1",
      roles: [managerRole("branch-1")],
      input: baseInput,
    })

    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "open", woNumber: `WO-${year}-00001`, createdBy: "user-1" }),
      })
    )
    expect(result).toEqual({ data: { id: "wo-1" }, woNumber: `WO-${year}-00001` })
  })
})

describe("deleteWorkOrder", () => {
  it("returns 404 when the work order is not found", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue(null)

    const result = await deleteWorkOrder(asDb(db), { id: "wo-1", companyId: "company-1" })

    expect(result).toEqual({ error: "Not found", status: 404 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("blocks deletion when transactions are already linked", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", _count: { transactions: 2 } })

    const result = await deleteWorkOrder(asDb(db), { id: "wo-1", companyId: "company-1" })

    expect(result).toEqual({ status: 400, error: { message: "ไม่สามารถลบใบสั่งงานที่มีการเบิกจ่ายอะไหล่แล้วได้" } })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("deletes dependent rows and the work order when there are no transactions", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", _count: { transactions: 0 } })

    const result = await deleteWorkOrder(asDb(db), { id: "wo-1", companyId: "company-1" })

    expect(db.$transaction).toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })
})
