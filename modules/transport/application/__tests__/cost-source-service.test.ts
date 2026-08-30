import { describe, expect, it } from "vitest"
import {
  isLockedReferenceAmount,
  jobSourceIdentity,
  mapJob,
  mapRepair,
  mapTire,
  toReferenceAmount,
} from "@/modules/transport/application/cost-source-service"

const VEHICLE = { id: "v1", plateNumber: "กข-1234" }

describe("toReferenceAmount", () => {
  it("keeps null and 0 distinct", () => {
    expect(toReferenceAmount(null)).toBeNull()
    expect(toReferenceAmount(undefined)).toBeNull()
    expect(toReferenceAmount("")).toBeNull()
    expect(toReferenceAmount(0)).toBe(0)
    expect(toReferenceAmount("0")).toBe(0)
    expect(toReferenceAmount(8500)).toBe(8500)
  })

  it("treats non-finite as null", () => {
    expect(toReferenceAmount("x")).toBeNull()
    expect(toReferenceAmount(Number.NaN)).toBeNull()
  })
})

describe("isLockedReferenceAmount", () => {
  it("locks only when amount is strictly greater than 0", () => {
    expect(isLockedReferenceAmount(null)).toBe(false)
    expect(isLockedReferenceAmount(0)).toBe(false)
    expect(isLockedReferenceAmount(8500)).toBe(true)
  })
})

describe("jobSourceIdentity", () => {
  it("is one job = one source with a null line id", () => {
    expect(jobSourceIdentity("job-1")).toEqual({
      sourceType: "TRANSPORT_JOB",
      sourceDocumentId: "job-1",
      sourceLineId: null,
    })
  })
})

describe("mapRepair / mapTire / mapJob", () => {
  it("maps closed repair null / 0 / >0 without collapsing null to 0", () => {
    const base = {
      id: "r1",
      branchId: "b1",
      reportedAt: new Date("2026-08-01T00:00:00.000Z"),
      vehicleId: "v1",
      paymentMethod: null,
      symptom: "น้ำมันรั่ว",
      repairNumber: "RP-2026-00001",
      vehicle: VEHICLE,
    }
    expect(mapRepair({ ...base, repairCost: null }).amount).toBeNull()
    expect(mapRepair({ ...base, repairCost: 0 }).amount).toBe(0)
    expect(mapRepair({ ...base, repairCost: 8500 }).amount).toBe(8500)
    expect(mapRepair({ ...base, repairCost: null }).documentNo).toBe("RP-2026-00001")
    expect(mapRepair({ ...base, repairCost: null }).description).toBe("น้ำมันรั่ว")
  })

  it("maps every tire log without a status field", () => {
    const row = mapTire({
      id: "t1",
      branchId: "b1",
      workDate: new Date("2026-08-02T00:00:00.000Z"),
      vehicleId: "v1",
      cost: null,
      paymentMethod: null,
      tireNumber: "TY-2026-00001",
      vehicle: VEHICLE,
    })
    expect(row.sourceType).toBe("TRANSPORT_TIRE")
    expect(row.amount).toBeNull()
    expect(row.documentNo).toBe("TY-2026-00001")
    expect(row.description).toBe("ค่ายาง")
  })

  it("maps one completed job to one source and does not emit stops", () => {
    const row = mapJob({
      id: "job-1",
      branchId: "b1",
      jobNumber: "JOB-001",
      customerName: "ลูกค้า A",
      scheduledDate: new Date("2026-08-03T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-03T00:00:00.000Z"),
      assignment: { vehicleId: "v1", vehicle: VEHICLE },
    })
    expect(row.sourceType).toBe("TRANSPORT_JOB")
    expect(row.sourceId).toBe("job-1")
    expect(row.amount).toBeNull()
    expect(row.documentNo).toBe("JOB-001")
    expect(row.description).toBe("ลูกค้า A")
    expect(row.description).not.toMatch(/^ใบงาน/)
    expect(row).not.toHaveProperty("stops")
  })
})
