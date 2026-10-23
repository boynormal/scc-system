import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { recordChecklistResult } from "@/modules/work_orders/application/work-order-checklist-service"
import { transitionWorkOrder } from "@/modules/work_orders/application/work-order-service"

function technicianRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Technician", permissions: null }
}

function adminRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Admin", permissions: null }
}

const pmWorkOrder = {
  id: "pm-1",
  woNumber: "WO-2026-00001",
  branchId: "branch-1",
  machineId: "machine-1",
  typeId: "type-1",
  priority: "medium",
  status: "in_progress",
  assignedTo: "user-1",
  scheduleId: "schedule-1",
}

function createMockDb() {
  const result = {
    id: "result-1",
    workOrderId: "pm-1",
    item: { itemName: "แรงดันลม", itemType: "numeric", unit: "bar", standardValue: "6" },
    followUp: null as null | { id: string; woNumber: string },
  }
  const db = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    workOrder: {
      findFirst: vi.fn().mockResolvedValue(pmWorkOrder),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => {
        const created = { id: "fix-1", woNumber: "WO-2026-00002" }
        result.followUp = created
        return created
      }),
      update: vi.fn(async ({ data }: { data: { status: string } }) => ({ id: "pm-1", status: data.status })),
    },
    workOrderStatusHistory: { create: vi.fn() },
    workOrderLaborEntry: { count: vi.fn().mockResolvedValue(0) },
    maintenanceSchedule: { update: vi.fn() },
    checklistResult: {
      findFirst: vi.fn(async () => ({ ...result })),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  }
  db.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof db) => Promise<unknown>)(db)
    return Promise.all(arg as Promise<unknown>[])
  })
  return db
}

function asDb(db: ReturnType<typeof createMockDb>) {
  return db as unknown as PrismaClient
}

const base = { id: "pm-1", companyId: "company-1", userId: "user-1" }

describe("recordChecklistResult", () => {
  it("creates exactly one corrective work order on the first fail", async () => {
    const db = createMockDb()
    const first = await recordChecklistResult(asDb(db), {
      ...base,
      roles: [technicianRole()],
      input: { resultId: "result-1", status: "fail", actualValue: "4.2", remark: "ลมรั่ว" },
    })
    expect(first).toEqual({
      data: { resultId: "result-1", status: "fail", followUp: { id: "fix-1", woNumber: "WO-2026-00002", created: true } },
    })
    expect(db.workOrder.create).toHaveBeenCalledTimes(1)
    const data = db.workOrder.create.mock.calls[0][0].data
    expect(data).toMatchObject({
      workKind: "corrective",
      status: "open",
      machineId: "machine-1",
      branchId: "branch-1",
      typeId: "type-1",
      sourceWorkOrderId: "pm-1",
      sourceChecklistResultId: "result-1",
      title: "แก้ไขจากการตรวจ: แรงดันลม",
    })
    expect(String(data.description)).toContain("ค่าที่วัดได้: 4.2 bar")
    expect(String(data.description)).toContain("หมายเหตุ: ลมรั่ว")

    const second = await recordChecklistResult(asDb(db), {
      ...base,
      roles: [technicianRole()],
      input: { resultId: "result-1", status: "fail", actualValue: "4.0", remark: null },
    })
    expect(second).toMatchObject({ data: { followUp: { id: "fix-1", created: false } } })
    expect(db.workOrder.create).toHaveBeenCalledTimes(1)
  })

  it("keeps the repair work order when the check later passes", async () => {
    const db = createMockDb()
    await recordChecklistResult(asDb(db), { ...base, roles: [technicianRole()], input: { resultId: "result-1", status: "fail" } })
    const pass = await recordChecklistResult(asDb(db), { ...base, roles: [technicianRole()], input: { resultId: "result-1", status: "pass" } })
    expect(pass).toMatchObject({ data: { status: "pass", followUp: { id: "fix-1", created: false } } })
    expect(db.workOrder.create).toHaveBeenCalledTimes(1)
  })

  it("does not create a repair work order for pass or n/a", async () => {
    const db = createMockDb()
    await recordChecklistResult(asDb(db), { ...base, roles: [technicianRole()], input: { resultId: "result-1", status: "na" } })
    expect(db.workOrder.create).not.toHaveBeenCalled()
    expect(db.checklistResult.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "na", recordedBy: "user-1" }) })
    )
  })

  it("rejects a user whose role is on another branch", async () => {
    const db = createMockDb()
    const result = await recordChecklistResult(asDb(db), {
      ...base,
      roles: [technicianRole("branch-2")],
      input: { resultId: "result-1", status: "fail" },
    })
    expect(result).toMatchObject({ status: 403 })
    expect(db.checklistResult.update).not.toHaveBeenCalled()
    expect(db.workOrder.create).not.toHaveBeenCalled()
  })

  it("rejects recording on a handed-over work order", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ ...pmWorkOrder, status: "handed_over" })
    const result = await recordChecklistResult(asDb(db), {
      ...base,
      roles: [technicianRole()],
      input: { resultId: "result-1", status: "pass" },
    })
    expect(result).toMatchObject({ status: 400 })
  })

  it("rejects a non-numeric value on a numeric item", async () => {
    const db = createMockDb()
    const result = await recordChecklistResult(asDb(db), {
      ...base,
      roles: [technicianRole()],
      input: { resultId: "result-1", status: "pass", actualValue: "สูง" },
    })
    expect(result).toMatchObject({ status: 400 })
    expect(db.checklistResult.update).not.toHaveBeenCalled()
  })
})

describe("transitionWorkOrder with checklist", () => {
  it("blocks handover while a required check is blank", async () => {
    const db = createMockDb()
    db.checklistResult.count.mockResolvedValue(2)
    const result = await transitionWorkOrder(asDb(db), {
      ...base,
      roles: [technicianRole()],
      input: { toStatus: "ready_for_handover" },
    })
    expect(result).toEqual({ error: "ยังมีข้อตรวจบังคับที่ยังไม่บันทึก 2 ข้อ", status: 400 })
    expect(db.workOrder.update).not.toHaveBeenCalled()
  })

  it("blocks cancel while a required check is blank", async () => {
    const db = createMockDb()
    db.checklistResult.count.mockResolvedValue(1)
    const result = await transitionWorkOrder(asDb(db), {
      ...base,
      roles: [adminRole()],
      input: { toStatus: "cancelled", reason: "เครื่องขายแล้ว" },
    })
    expect(result).toMatchObject({ status: 400 })
    expect(db.workOrder.update).not.toHaveBeenCalled()
  })

  it("closes the round when the PM work order is handed over", async () => {
    const db = createMockDb()
    db.workOrder.findFirst.mockResolvedValue({ ...pmWorkOrder, status: "ready_for_handover" })
    const result = await transitionWorkOrder(asDb(db), {
      ...base,
      roles: [technicianRole()],
      input: { toStatus: "handed_over" },
    })
    expect(result).toEqual({ data: { id: "pm-1", status: "handed_over" } })
    expect(db.maintenanceSchedule.update).toHaveBeenCalledWith({
      where: { id: "schedule-1" },
      data: { status: "completed" },
    })
  })
})
