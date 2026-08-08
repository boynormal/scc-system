import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"
import { createRepair } from "@/modules/transport/application/repair-service"

function adminRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Admin", permissions: null }
}

function createMockDb() {
  return {
    transportVehicle: { findFirst: vi.fn() },
    transportRepairLog: { findFirst: vi.fn(), create: vi.fn() },
  }
}

type MockDb = ReturnType<typeof createMockDb>

function asDb(mockDb: MockDb): PrismaClient {
  return mockDb as unknown as PrismaClient
}

const COMPANY_ID = "company-1"
const USER_ID = "user-1"
const VEHICLE = {
  id: "vehicle-1",
  companyId: COMPANY_ID,
  branchId: "branch-1",
  isActive: true,
  mileage: 1000,
}

const baseParams = {
  companyId: COMPANY_ID,
  userId: USER_ID,
  roles: [adminRole()],
  input: { vehicleId: "vehicle-1", symptom: "เบรกดัง" },
}

describe("createRepair", () => {
  it("allows create when the only open repair is inspection", async () => {
    const db = createMockDb()
    db.transportVehicle.findFirst.mockResolvedValue(VEHICLE)
    db.transportRepairLog.findFirst.mockResolvedValue(null) // no reported/in_repair
    db.transportRepairLog.create.mockResolvedValue({ id: "repair-new", status: "reported" })

    const result = await createRepair(asDb(db), baseParams)

    expect(db.transportRepairLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["reported", "in_repair"] },
        }),
      })
    )
    expect(db.transportRepairLog.create).toHaveBeenCalled()
    expect(result).toEqual({ id: "repair-new", status: "reported" })
  })

  it("blocks create when vehicle has reported repair", async () => {
    const db = createMockDb()
    db.transportVehicle.findFirst.mockResolvedValue(VEHICLE)
    db.transportRepairLog.findFirst.mockResolvedValue({ id: "repair-1", status: "reported" })

    await expect(createRepair(asDb(db), baseParams)).rejects.toThrow(/ใบแจ้งซ่อมที่ยังไม่ปิด/)
    expect(db.transportRepairLog.create).not.toHaveBeenCalled()
  })

  it("blocks create when vehicle is in_repair", async () => {
    const db = createMockDb()
    db.transportVehicle.findFirst.mockResolvedValue(VEHICLE)
    db.transportRepairLog.findFirst.mockResolvedValue({ id: "repair-1", status: "in_repair" })

    await expect(createRepair(asDb(db), baseParams)).rejects.toThrow(/กำลังซ่อมอยู่แล้ว/)
    expect(db.transportRepairLog.create).not.toHaveBeenCalled()
  })
})
