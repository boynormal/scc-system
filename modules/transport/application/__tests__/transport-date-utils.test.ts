import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getBangkokTodayRange, isScheduledTodayBangkok } from "@/modules/transport/application/transport-date-utils"

// Fixed "now": 2026-07-22T10:00:00+07:00 == 2026-07-22T03:00:00.000Z
const FIXED_NOW = new Date("2026-07-22T03:00:00.000Z")

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("getBangkokTodayRange", () => {
  it("returns start/end matching Bangkok midnight boundaries (UTC+7)", () => {
    const { start, end } = getBangkokTodayRange()

    expect(start.toISOString()).toBe("2026-07-21T17:00:00.000Z")
    expect(end.toISOString()).toBe("2026-07-22T16:59:59.999Z")
  })
})

describe("isScheduledTodayBangkok", () => {
  it("treats null/undefined scheduledDate as today", () => {
    expect(isScheduledTodayBangkok(null)).toBe(true)
    expect(isScheduledTodayBangkok(undefined)).toBe(true)
  })

  it("returns true for a date within today's Bangkok range", () => {
    const withinRange = new Date("2026-07-22T12:00:00+07:00")
    expect(isScheduledTodayBangkok(withinRange)).toBe(true)
  })

  it("returns true at the exact start/end boundaries", () => {
    const start = new Date("2026-07-22T00:00:00+07:00")
    const end = new Date("2026-07-22T23:59:59.999+07:00")
    expect(isScheduledTodayBangkok(start)).toBe(true)
    expect(isScheduledTodayBangkok(end)).toBe(true)
  })

  it("returns false for a date outside today's Bangkok range", () => {
    const yesterday = new Date("2026-07-21T23:59:00+07:00")
    const tomorrow = new Date("2026-07-23T00:00:01+07:00")
    expect(isScheduledTodayBangkok(yesterday)).toBe(false)
    expect(isScheduledTodayBangkok(tomorrow)).toBe(false)
  })
})
