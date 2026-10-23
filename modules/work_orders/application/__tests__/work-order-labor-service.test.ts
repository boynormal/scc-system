import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { transitionWorkOrder } from "@/modules/work_orders/application/work-order-service"
import {
  applyLaborAction,
  editLaborEntry,
  summarizeLabor,
} from "@/modules/work_orders/application/work-order-labor-service"

function adminRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Admin", permissions: null }
}

function managerRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Manager", permissions: null }
}

function createMockDb() {
  const db = {
    workOrder: { findFirst: vi.fn(), update: vi.fn() },
    workOrderTechnician: { findFirst: vi.fn() },
    workOrderLaborEntry: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
    workOrderStatusHistory: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  }
  db.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof db) => Promise<unknown>)(db)
    return Promise.all(arg as Promise<unknown>[])
  })
  return db
}

function asDb(mockDb: ReturnType<typeof createMockDb>): PrismaClient {
  return mockDb as unknown as PrismaClient
}

const closedEntry = {
  id: "entry-1",
  userId: "user-1",
  workOrderId: "wo-1",
  entryType: "work" as const,
  startedAt: new Date("2020-01-01T01:00:00.000Z"),
  endedAt: new Date("2020-01-01T02:00:00.000Z"),
  waitReason: null,
  note: null,
  editReason: null,
}

describe("applyLaborAction", () => {
  it("auto-closes an open entry on another work order and moves assigned work to in_progress", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({
      id: "wo-b",
      branchId: "branch-1",
      status: "assigned",
      assignedTo: "user-1",
      woNumber: "WO-B",
    })
    db.workOrderLaborEntry.findFirst.mockResolvedValue({
      id: "open-1",
      userId: "user-1",
      workOrderId: "wo-a",
      entryType: "work",
      startedAt: new Date("2020-01-01T01:00:00.000Z"),
      endedAt: null,
      workOrder: { id: "wo-a", woNumber: "WO-A" },
    })
    db.workOrderLaborEntry.create.mockResolvedValue({ id: "new-1", entryType: "work" })
    db.workOrder.update.mockResolvedValue({ id: "wo-b", status: "in_progress" })

    const result = await applyLaborAction(asDb(db), {
      id: "wo-b",
      companyId: "company-1",
      actorId: "actor-1",
      roles: [managerRole()],
      input: { action: "start", userId: "user-1" },
    })

    expect(result).toMatchObject({ data: { entryId: "new-1", autoClosed: { woNumber: "WO-A", workOrderId: "wo-a" } } })
    expect(db.workOrderLaborEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "open-1" }, data: expect.objectContaining({ endedAt: expect.any(Date) }) })
    )
    expect(db.workOrderLaborEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workOrderId: "wo-b", userId: "user-1", entryType: "work" }),
      })
    )
    expect(db.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "in_progress" }) })
    )
    expect(db.workOrderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fromStatus: "assigned", toStatus: "in_progress" }) })
    )
  })

  it("rejects a user who is not on the work order crew", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      branchId: "branch-1",
      status: "in_progress",
      assignedTo: "other-user",
    })
    db.workOrderTechnician.findFirst.mockResolvedValue(null)

    const result = await applyLaborAction(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      actorId: "actor-1",
      roles: [managerRole()],
      input: { action: "start", userId: "user-1" },
    })

    expect(result).toEqual({ error: "ผู้ใช้นี้ไม่อยู่ในรายชื่อช่างของใบงาน", status: 400 })
    expect(db.workOrderLaborEntry.create).not.toHaveBeenCalled()
  })

  it("returns 403 when the caller cannot update the work order branch", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      branchId: "branch-2",
      status: "in_progress",
      assignedTo: "user-1",
    })

    const result = await applyLaborAction(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      actorId: "actor-1",
      roles: [managerRole("branch-1")],
      input: { action: "start", userId: "user-1" },
    })

    expect(result).toMatchObject({ error: "Forbidden", status: 403 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects pause without a wait reason", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      branchId: "branch-1",
      status: "in_progress",
      assignedTo: "user-1",
    })

    const result = await applyLaborAction(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      actorId: "actor-1",
      roles: [managerRole()],
      input: { action: "pause", userId: "user-1" },
    })

    expect(result).toEqual({ error: "ต้องระบุเหตุผลการรอ", status: 400 })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe("editLaborEntry", () => {
  const editInput = {
    startedAt: "2020-01-02T01:00:00.000Z",
    endedAt: "2020-01-02T02:00:00.000Z",
    reason: "แก้เวลาที่กดผิด",
  }

  it("rejects a back-dated edit without a reason", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", status: "in_progress", assignedTo: "user-1" })

    const result = await editLaborEntry(asDb(db), {
      id: "wo-1",
      entryId: "entry-1",
      companyId: "company-1",
      actorId: "actor-1",
      roles: [managerRole()],
      input: { ...editInput, reason: "no" },
    })

    expect(result).toEqual({ error: "ต้องระบุเหตุผล", status: 400 })
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })

  it("rejects an edit that overlaps another entry for the same person", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", status: "in_progress", assignedTo: "user-1" })
    db.workOrderLaborEntry.findFirst.mockResolvedValueOnce(closedEntry).mockResolvedValueOnce({ id: "other" })

    const result = await editLaborEntry(asDb(db), {
      id: "wo-1",
      entryId: "entry-1",
      companyId: "company-1",
      actorId: "actor-1",
      roles: [managerRole()],
      input: editInput,
    })

    expect(result).toEqual({ error: "ช่วงเวลาซ้อนกับรายการอื่นของช่างคนนี้", status: 400 })
    expect(db.workOrderLaborEntry.update).not.toHaveBeenCalled()
    expect(db.auditLog.create).not.toHaveBeenCalled()
  })

  it("writes an audit row when the edit is accepted", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", status: "in_progress", assignedTo: "user-1" })
    db.workOrderLaborEntry.findFirst.mockResolvedValueOnce(closedEntry).mockResolvedValueOnce(null)
    db.workOrderLaborEntry.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...closedEntry,
      ...args.data,
    }))

    const result = await editLaborEntry(asDb(db), {
      id: "wo-1",
      entryId: "entry-1",
      companyId: "company-1",
      actorId: "actor-1",
      roles: [managerRole()],
      input: editInput,
    })

    expect(result).toEqual({ data: { id: "entry-1" } })
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tableName: "work_order_labor_entries",
          recordId: "entry-1",
          action: "update",
          userId: "actor-1",
        }),
      })
    )
  })
})

describe("summarizeLabor", () => {
  it("keeps wait out of work hours and totals each person separately", () => {
    const now = new Date("2020-01-01T03:00:00.000Z")
    const rows = summarizeLabor(
      [
        { userId: "user-a", entryType: "work", startedAt: new Date("2020-01-01T01:00:00.000Z"), endedAt: new Date("2020-01-01T02:00:00.000Z") },
        { userId: "user-a", entryType: "wait", startedAt: new Date("2020-01-01T02:00:00.000Z"), endedAt: new Date("2020-01-01T02:30:00.000Z") },
        { userId: "user-a", entryType: "work", startedAt: new Date("2020-01-01T02:30:00.000Z"), endedAt: null },
        { userId: "user-b", entryType: "work", startedAt: new Date("2020-01-01T01:00:00.000Z"), endedAt: new Date("2020-01-01T01:45:00.000Z") },
      ],
      now
    )

    expect(rows).toEqual([
      { userId: "user-a", workMinutes: 90, waitMinutes: 30, travelMinutes: 0 },
      { userId: "user-b", workMinutes: 45, waitMinutes: 0, travelMinutes: 0 },
    ])
  })
})

describe("transitionWorkOrder labor guard", () => {
  it("rejects close while a labor entry is still open", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", status: "handed_over", assignedTo: "user-1" })
    db.workOrderLaborEntry.count.mockResolvedValue(1)

    const result = await transitionWorkOrder(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      userId: "actor-1",
      roles: [adminRole()],
      input: { toStatus: "closed" },
    })

    expect(result).toEqual({ error: "ยังมีช่างที่จับเวลาค้างอยู่", status: 400 })
    expect(db.workOrder.update).not.toHaveBeenCalled()
  })

  it("rejects handover while a labor entry is still open", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ id: "wo-1", branchId: "branch-1", status: "in_progress", assignedTo: "user-1" })
    db.workOrderLaborEntry.count.mockResolvedValue(1)

    const result = await transitionWorkOrder(asDb(db), {
      id: "wo-1",
      companyId: "company-1",
      userId: "actor-1",
      roles: [managerRole()],
      input: { toStatus: "ready_for_handover" },
    })

    expect(result).toEqual({ error: "ยังมีช่างที่จับเวลาค้างอยู่", status: 400 })
    expect(db.workOrder.update).not.toHaveBeenCalled()
  })
})
