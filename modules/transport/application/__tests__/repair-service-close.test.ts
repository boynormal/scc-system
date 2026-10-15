import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import type { UserRole } from "@/lib/permissions"
import { closeRepair, markRepairInspection } from "@/modules/transport/application/repair-service"

function adminRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Admin", permissions: null }
}

function createMockDb() {
  return {
    transportRepairLog: { findFirst: vi.fn(), update: vi.fn() },
    transportVehicle: { update: vi.fn() },
    $transaction: vi.fn(),
  }
}

type MockDb = ReturnType<typeof createMockDb>

function asDb(mockDb: MockDb): PrismaClient {
  return mockDb as unknown as PrismaClient
}

const COMPANY_ID = "company-1"
const USER_ID = "user-1"
const REPAIR = {
  id: "repair-1",
  companyId: COMPANY_ID,
  branchId: "branch-1",
  vehicleId: "vehicle-1",
  status: "in_repair",
  repairCost: null,
  paymentMethod: null,
}

describe("closeRepair", () => {
  it("closes when repairCost is null", async () => {
    const db = createMockDb()
    const closed = { ...REPAIR, status: "closed" }
    db.transportRepairLog.findFirst.mockResolvedValue(REPAIR)
    db.$transaction.mockResolvedValue([closed])

    const result = await closeRepair(asDb(db), {
      id: REPAIR.id,
      companyId: COMPANY_ID,
      userId: USER_ID,
      roles: [adminRole()],
    })

    expect(result).toEqual(closed)
    expect(db.transportRepairLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "closed" }),
      })
    )
    expect(db.transportVehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { currentStatus: "available" },
      })
    )
  })

  it("rejects inspection because that status is retired", async () => {
    const db = createMockDb()
    db.transportRepairLog.findFirst.mockResolvedValue({ ...REPAIR, status: "inspection" })

    await expect(
      closeRepair(asDb(db), {
        id: REPAIR.id,
        companyId: COMPANY_ID,
        userId: USER_ID,
        roles: [adminRole()],
      })
    ).rejects.toThrow(/กำลังซ่อม/)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects the retired inspect action", async () => {
    const db = createMockDb()
    db.transportRepairLog.findFirst.mockResolvedValue(REPAIR)

    await expect(
      markRepairInspection(asDb(db), {
        id: REPAIR.id,
        companyId: COMPANY_ID,
        userId: USER_ID,
        roles: [adminRole()],
      })
    ).rejects.toThrow(/สถานะตรวจสอบถูกยกเลิก/)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("rejects when amount is set without payment method", async () => {
    const db = createMockDb()
    db.transportRepairLog.findFirst.mockResolvedValue({
      ...REPAIR,
      repairCost: 8500,
      paymentMethod: null,
    })

    await expect(
      closeRepair(asDb(db), {
        id: REPAIR.id,
        companyId: COMPANY_ID,
        userId: USER_ID,
        roles: [adminRole()],
      })
    ).rejects.toThrow(/วิธีจ่าย/)
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
