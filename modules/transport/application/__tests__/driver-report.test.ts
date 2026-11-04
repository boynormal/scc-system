import { describe, expect, it } from "vitest"
import {
  LICENSE_EXPIRING_DAYS,
  licenseReadiness,
  summarizeDriver,
  type DriverReportJob,
} from "@/modules/transport/application/driver-report"

const TODAY = "2026-11-04"

function at(hours: number, minutes = 0) {
  return new Date(Date.UTC(2026, 10, 4, hours - 7, minutes))
}

function punch(
  kind: DriverReportJob["punches"][number]["kind"],
  over: Partial<DriverReportJob["punches"][number]> = {}
): DriverReportJob["punches"][number] {
  return {
    stopId: over.stopId ?? null,
    kind,
    recordedAt: over.recordedAt ?? at(8),
    odometerKm: over.odometerKm ?? null,
    latitude: over.latitude === undefined ? 13.7 : over.latitude,
    longitude: over.longitude === undefined ? 100.5 : over.longitude,
    gpsLatitude: over.gpsLatitude ?? null,
    gpsLongitude: over.gpsLongitude ?? null,
  }
}

const drop = [{ id: "drop", sequence: 1, status: "pending" }]

function driver(jobs: DriverReportJob[]) {
  return summarizeDriver(
    {
      id: "d1",
      name: "สมชาย ใจดี",
      branchName: "สำนักงานใหญ่",
      vehiclePlate: "กข-1",
      licenseExpiry: new Date("2027-01-01T00:00:00+07:00"),
      jobs,
    },
    TODAY
  )
}

describe("licenseReadiness", () => {
  it("marks a missing date, an expired date, a date within 30 days, and a later date", () => {
    expect(licenseReadiness(null, TODAY)).toBe("missing")
    expect(licenseReadiness(new Date("2026-11-03T00:00:00+07:00"), TODAY)).toBe("expired")
    expect(licenseReadiness(new Date("2026-12-04T00:00:00+07:00"), TODAY)).toBe("expiring")
    const later = new Date(`${TODAY}T12:00:00+07:00`)
    later.setTime(later.getTime() + (LICENSE_EXPIRING_DAYS + 1) * 24 * 60 * 60 * 1000)
    expect(licenseReadiness(later, TODAY)).toBe("ok")
  })
})

describe("summarizeDriver", () => {
  it("keeps a driver with no jobs at zero", () => {
    const row = driver([])
    expect(row.jobCount).toBe(0)
    expect(row.incompleteCheckins).toBe(0)
    expect(row.missingLocations).toBe(0)
    expect(row.completeCheckins).toBe(0)
    expect(row.totalKm).toBe(0)
    expect(row.unmeasuredJobs).toBe(0)
    expect(row.longDwells).toBe(0)
    expect(row.slowTravels).toBe(0)
  })

  it("counts an unfinished check-in and a trip with no odometer", () => {
    const row = driver([
      {
        status: "en_route",
        stops: drop,
        punches: [punch("start")],
      },
    ])
    expect(row.incompleteCheckins).toBe(1)
    expect(row.unmeasuredJobs).toBe(1)
    expect(row.completedCount).toBe(0)
  })

  it("counts a finished sequence that is missing a map point", () => {
    const row = driver([
      {
        status: "completed",
        stops: drop,
        punches: [
          punch("start", { odometerKm: 100 }),
          punch("arrive", { stopId: "drop", recordedAt: at(9), odometerKm: 110 }),
          punch("depart", { stopId: "drop", recordedAt: at(9, 20), odometerKm: 110 }),
          punch("finish", {
            recordedAt: at(10),
            odometerKm: 120,
            latitude: null,
            longitude: null,
          }),
        ],
      },
    ])
    expect(row.missingLocations).toBe(1)
    expect(row.completeCheckins).toBe(0)
    expect(row.completedCount).toBe(1)
    expect(row.totalKm).toBe(20)
    expect(row.unmeasuredJobs).toBe(0)
  })

  it("sums distance and warning legs, and ignores a skipped stop", () => {
    const row = driver([
      {
        status: "completed",
        stops: [
          { id: "drop", sequence: 1, status: "pending" },
          { id: "later", sequence: 2, status: "skipped" },
        ],
        punches: [
          punch("start", { odometerKm: 0, recordedAt: at(8) }),
          punch("arrive", { stopId: "drop", odometerKm: 10, recordedAt: at(9) }),
          punch("depart", { stopId: "drop", odometerKm: 10, recordedAt: at(11, 1) }),
          punch("finish", { odometerKm: 30, recordedAt: at(12, 1) }),
        ],
      },
    ])
    expect(row.completeCheckins).toBe(1)
    expect(row.incompleteCheckins).toBe(0)
    expect(row.totalKm).toBe(30)
    expect(row.slowTravels).toBe(1)
    expect(row.longDwells).toBe(1)
  })
})
