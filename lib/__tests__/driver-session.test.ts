import { describe, expect, it } from "vitest"
import { driverHomePath, isDriverAllowedPath, isDriverLogPath } from "@/lib/driver-session"

const jobId = "11111111-1111-4111-8111-111111111111"

describe("driver session gate", () => {
  it("sends a driver home to the scanned job or the scan prompt", () => {
    expect(driverHomePath(undefined)).toBe("/transport/drive")
    expect(driverHomePath("not-a-job")).toBe("/transport/drive")
    expect(driverHomePath(jobId)).toBe(`/transport/jobs/${jobId}/log`)
  })

  it("allows only the log page, its punch API, and the scan prompt", () => {
    expect(isDriverLogPath(`/transport/jobs/${jobId}/log`)).toBe(true)
    expect(isDriverAllowedPath(`/transport/jobs/${jobId}/log`)).toBe(true)
    expect(isDriverAllowedPath(`/api/transport/jobs/${jobId}/punches`)).toBe(true)
    expect(isDriverAllowedPath("/transport/drive")).toBe(true)
    expect(isDriverAllowedPath("/api/auth/session")).toBe(true)
    expect(isDriverAllowedPath("/transport/jobs")).toBe(false)
    expect(isDriverAllowedPath("/")).toBe(false)
    expect(isDriverAllowedPath(`/transport/jobs/${jobId}`)).toBe(false)
  })
})
