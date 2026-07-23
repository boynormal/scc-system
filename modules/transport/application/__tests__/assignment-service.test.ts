import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"

vi.mock("@/modules/transport/application/transport-date-utils", () => ({
  isScheduledTodayBangkok: vi.fn(),
}))

import { isScheduledTodayBangkok } from "@/modules/transport/application/transport-date-utils"
import { assignJob, completeJob, performAssignment, unassignJob } from "@/modules/transport/application/assignment-service"

const mockedIsScheduledToday = vi.mocked(isScheduledTodayBangkok)

function adminRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Admin", permissions: null }
}

function viewerRole(branchId = "branch-1"): UserRole {
  return { branchId, branchName: "HQ", roleName: "Viewer", permissions: null }
}

function createMockDb() {
  return {
    transportVehicle: { findFirst: vi.fn(), update: vi.fn() },
    driver: { findFirst: vi.fn(), update: vi.fn() },
    transportJob: { findFirst: vi.fn(), update: vi.fn() },
    jobAssignment: { upsert: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  }
}

type MockDb = ReturnType<typeof createMockDb>

function asDb(mockDb: MockDb): PrismaClient {
  return mockDb as unknown as PrismaClient
}

const COMPANY_ID = "company-1"
const USER_ID = "user-1"

beforeEach(() => {
  mockedIsScheduledToday.mockReset()
})

describe("assignJob", () => {
  it("throws NotFoundError when the job is not found in company scope", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue(null)

    await expect(
      assignJob(asDb(db), {
        jobId: "job-1",
        companyId: COMPANY_ID,
        userId: USER_ID,
        roles: [adminRole()],
        input: { vehicleId: "vehicle-1", driverId: "driver-1" },
      })
    ).rejects.toThrow(NotFoundError)
  })

  it("throws ValidationError when the job is completed or cancelled", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({ id: "job-1", branchId: "branch-1", status: "completed" })

    await expect(
      assignJob(asDb(db), {
        jobId: "job-1",
        companyId: COMPANY_ID,
        userId: USER_ID,
        roles: [adminRole()],
        input: { vehicleId: "vehicle-1", driverId: "driver-1" },
      })
    ).rejects.toThrow(ValidationError)
  })

  it("throws ForbiddenError when the role has no update permission and is not admin", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({ id: "job-1", branchId: "branch-1", status: "pending_assignment" })

    await expect(
      assignJob(asDb(db), {
        jobId: "job-1",
        companyId: COMPANY_ID,
        userId: USER_ID,
        roles: [viewerRole("branch-1")],
        input: { vehicleId: "vehicle-1", driverId: "driver-1" },
      })
    ).rejects.toThrow(ForbiddenError)
  })
})

describe("performAssignment", () => {
  const baseParams = {
    jobId: "job-1",
    companyId: COMPANY_ID,
    userId: USER_ID,
    input: { vehicleId: "vehicle-1", driverId: "driver-1" },
  }

  it("marks vehicle and driver on_job when scheduled today (Bangkok)", async () => {
    const db = createMockDb()
    db.transportVehicle.findFirst.mockResolvedValue({ id: "vehicle-1" })
    db.driver.findFirst.mockResolvedValue({ id: "driver-1" })
    db.jobAssignment.upsert.mockResolvedValue({ jobId: "job-1" })
    db.transportJob.update.mockResolvedValue({})
    db.transportVehicle.update.mockResolvedValue({})
    db.driver.update.mockResolvedValue({})
    mockedIsScheduledToday.mockReturnValue(true)

    await performAssignment(asDb(db), { ...baseParams, scheduledDate: new Date() })

    expect(db.transportVehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStatus: "on_job" } })
    )
    expect(db.driver.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentStatus: "on_job" } }))
    expect(db.transportJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "assigned" } }))
  })

  it("does not touch vehicle/driver status when not scheduled today", async () => {
    const db = createMockDb()
    db.transportVehicle.findFirst.mockResolvedValue({ id: "vehicle-1" })
    db.driver.findFirst.mockResolvedValue({ id: "driver-1" })
    db.jobAssignment.upsert.mockResolvedValue({ jobId: "job-1" })
    db.transportJob.update.mockResolvedValue({})
    mockedIsScheduledToday.mockReturnValue(false)

    await performAssignment(asDb(db), { ...baseParams, scheduledDate: new Date() })

    expect(db.transportVehicle.update).not.toHaveBeenCalled()
    expect(db.driver.update).not.toHaveBeenCalled()
    expect(db.transportJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "assigned" } }))
  })

  it("throws NotFoundError when the vehicle does not belong to the company", async () => {
    const db = createMockDb()
    db.transportVehicle.findFirst.mockResolvedValue(null)

    await expect(performAssignment(asDb(db), { ...baseParams, scheduledDate: null })).rejects.toThrow(NotFoundError)
  })
})

describe("completeJob", () => {
  it("throws ValidationError when already completed", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({ id: "job-1", branchId: "branch-1", status: "completed", assignment: null })

    await expect(
      completeJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })
    ).rejects.toThrow(ValidationError)
  })

  it("throws ValidationError when already cancelled", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({ id: "job-1", branchId: "branch-1", status: "cancelled", assignment: null })

    await expect(
      completeJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })
    ).rejects.toThrow(ValidationError)
  })

  it("updates only the job status when there is no assignment", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({
      id: "job-1",
      branchId: "branch-1",
      status: "en_route",
      assignment: null,
      scheduledDate: null,
    })
    db.transportJob.update.mockResolvedValue({})

    await completeJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })

    expect(db.transportJob.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "completed" } }))
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(db.transportVehicle.update).not.toHaveBeenCalled()
    expect(db.driver.update).not.toHaveBeenCalled()
  })

  it("frees vehicle/driver when scheduled today and an assignment exists", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({
      id: "job-1",
      branchId: "branch-1",
      status: "en_route",
      scheduledDate: new Date(),
      assignment: { vehicleId: "vehicle-1", driverId: "driver-1" },
    })
    db.transportJob.update.mockResolvedValue({})
    db.jobAssignment.update.mockResolvedValue({})
    db.transportVehicle.update.mockResolvedValue({})
    db.driver.update.mockResolvedValue({})
    mockedIsScheduledToday.mockReturnValue(true)

    await completeJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })

    expect(db.transportVehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "vehicle-1" }, data: { currentStatus: "available" } })
    )
    expect(db.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "driver-1" }, data: { currentStatus: "available" } })
    )
  })

  it("does not touch vehicle/driver when an assignment exists but is not scheduled today", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({
      id: "job-1",
      branchId: "branch-1",
      status: "en_route",
      scheduledDate: new Date(),
      assignment: { vehicleId: "vehicle-1", driverId: "driver-1" },
    })
    db.transportJob.update.mockResolvedValue({})
    db.jobAssignment.update.mockResolvedValue({})
    mockedIsScheduledToday.mockReturnValue(false)

    await completeJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })

    expect(db.transportVehicle.update).not.toHaveBeenCalled()
    expect(db.driver.update).not.toHaveBeenCalled()
  })
})

describe("unassignJob", () => {
  it("throws NotFoundError when the job is not found", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue(null)

    await expect(
      unassignJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })
    ).rejects.toThrow(NotFoundError)
  })

  it("throws NotFoundError when the job has no assignment", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({ id: "job-1", branchId: "branch-1", assignment: null })

    await expect(
      unassignJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })
    ).rejects.toThrow(NotFoundError)
  })

  it("frees vehicle/driver when scheduled today", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({
      id: "job-1",
      branchId: "branch-1",
      scheduledDate: new Date(),
      assignment: { vehicleId: "vehicle-1", driverId: "driver-1" },
    })
    db.jobAssignment.delete.mockResolvedValue({})
    db.transportJob.update.mockResolvedValue({})
    db.transportVehicle.update.mockResolvedValue({})
    db.driver.update.mockResolvedValue({})
    mockedIsScheduledToday.mockReturnValue(true)

    await unassignJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })

    expect(db.transportVehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "vehicle-1" }, data: { currentStatus: "available" } })
    )
    expect(db.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "driver-1" }, data: { currentStatus: "available" } })
    )
    expect(db.transportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "pending_assignment" } })
    )
  })

  it("does not touch vehicle/driver when not scheduled today", async () => {
    const db = createMockDb()
    db.transportJob.findFirst.mockResolvedValue({
      id: "job-1",
      branchId: "branch-1",
      scheduledDate: new Date(),
      assignment: { vehicleId: "vehicle-1", driverId: "driver-1" },
    })
    db.jobAssignment.delete.mockResolvedValue({})
    db.transportJob.update.mockResolvedValue({})
    mockedIsScheduledToday.mockReturnValue(false)

    await unassignJob(asDb(db), { jobId: "job-1", companyId: COMPANY_ID, roles: [adminRole()] })

    expect(db.transportVehicle.update).not.toHaveBeenCalled()
    expect(db.driver.update).not.toHaveBeenCalled()
  })
})
