import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { ValidationError } from "@/lib/errors"
import type { UserRole } from "@/lib/permissions"

vi.mock("@/modules/transport/application/transport-job-access", () => ({
  canTransportJobs: vi.fn().mockReturnValue(true),
  transportJobAllowed: vi.fn().mockResolvedValue(true),
  transportJobListBranchIds: vi.fn().mockResolvedValue(null),
}))

import { attachPickupRequestToJob } from "@/modules/transport/application/job-service"
import { loadLinkablePickupRequest } from "@/modules/transport/application/pickup-request-service"

const roles: UserRole[] = [{ branchId: "branch-1", branchName: "HQ", roleName: "Admin", permissions: null }]

function requestRow(jobStop: unknown = null) {
  return {
    id: "req-1",
    requestNo: 7,
    status: "SUBMITTED",
    contactName: null,
    phone: null,
    note: null,
    jobStopId: jobStop ? "old-stop" : null,
    createdAt: new Date("2026-11-05T01:00:00.000Z"),
    customer: { id: "cust-1", name: "ร้าน A", address: "1 ถนนสุข", contactName: null, phone: null },
    lines: [
      {
        id: "line-1",
        cargoTypeId: "cargo-1",
        unitId: "unit-1",
        quantity: "4",
        note: null,
        cargoType: { id: "cargo-1", name: "ข้าวสาร" },
        unit: { id: "unit-1", name: "กระสอบ" },
      },
    ],
    jobStop,
  }
}

function createMockDb() {
  const tx = {
    jobStop: {
      aggregate: vi.fn().mockResolvedValue({ _max: { sequence: 2 } }),
      create: vi.fn().mockResolvedValue({ id: "new-stop", sequence: 3 }),
    },
    tmsPickupRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }
  return {
    tx,
    transportJob: {
      findFirst: vi.fn().mockResolvedValue({
        id: "job-1",
        branchId: "branch-1",
        status: "assigned",
        stops: [
          { id: "s1", sequence: 1, status: "pending" },
          { id: "s2", sequence: 2, status: "pending" },
        ],
        punches: [],
      }),
    },
    tmsPickupRequest: { findFirst: vi.fn().mockResolvedValue(requestRow()) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  }
}

type MockDb = ReturnType<typeof createMockDb>
const asDb = (db: MockDb) => db as unknown as PrismaClient

describe("loadLinkablePickupRequest", () => {
  it("returns a waiting request", async () => {
    const db = createMockDb()
    await expect(loadLinkablePickupRequest(asDb(db), "co-1", "req-1")).resolves.toMatchObject({ id: "req-1" })
  })

  it("rejects a request already on a live stop", async () => {
    const db = createMockDb()
    db.tmsPickupRequest.findFirst.mockResolvedValue(
      requestRow({
        id: "old-stop",
        status: "pending",
        estimatedArrival: null,
        punches: [],
        job: { id: "job-0", jobNumber: "TJ-1", status: "assigned", scheduledDate: null },
      })
    )
    await expect(loadLinkablePickupRequest(asDb(db), "co-1", "req-1")).rejects.toBeInstanceOf(ValidationError)
  })

  it("allows a request whose old stop was skipped", async () => {
    const db = createMockDb()
    db.tmsPickupRequest.findFirst.mockResolvedValue(
      requestRow({
        id: "old-stop",
        status: "skipped",
        estimatedArrival: null,
        punches: [],
        job: { id: "job-0", jobNumber: "TJ-1", status: "en_route", scheduledDate: null },
      })
    )
    await expect(loadLinkablePickupRequest(asDb(db), "co-1", "req-1")).resolves.toMatchObject({ id: "req-1" })
  })
})

describe("attachPickupRequestToJob", () => {
  let db: MockDb
  beforeEach(() => {
    db = createMockDb()
  })

  const params = { companyId: "co-1", userId: "user-1", roles, requestId: "req-1", jobId: "job-1" }

  it("appends the request as the next stop and links it", async () => {
    const result = await attachPickupRequestToJob(asDb(db), params)
    expect(result).toEqual({ jobId: "job-1", stopId: "new-stop", sequence: 3 })
    expect(db.tx.jobStop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobId: "job-1",
          sequence: 3,
          customerName: "ร้าน A",
          notes: "คำขอ #7: ข้าวสาร 4 กระสอบ",
        }),
      })
    )
    expect(db.tx.tmsPickupRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", jobStopId: null },
      data: { jobStopId: "new-stop" },
    })
  })

  it("throws when another user linked the request first", async () => {
    db.tx.tmsPickupRequest.updateMany.mockResolvedValue({ count: 0 })
    await expect(attachPickupRequestToJob(asDb(db), params)).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects a job whose driver already reached the last stop", async () => {
    db.transportJob.findFirst.mockResolvedValue({
      id: "job-1",
      branchId: "branch-1",
      status: "en_route",
      stops: [
        { id: "s1", sequence: 1, status: "completed" },
        { id: "s2", sequence: 2, status: "arrived" },
      ],
      punches: [
        { stopId: null, kind: "start" },
        { stopId: "s2", kind: "arrive" },
      ],
    })
    await expect(attachPickupRequestToJob(asDb(db), params)).rejects.toBeInstanceOf(ValidationError)
    expect(db.tx.jobStop.create).not.toHaveBeenCalled()
  })
})
