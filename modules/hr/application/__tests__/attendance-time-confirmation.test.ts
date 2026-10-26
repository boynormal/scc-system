import { describe, expect, it } from "vitest"
import { summarizeManHour } from "@/modules/hr/application/attendance-man-hour"
import { effectiveDayTimes } from "@/modules/hr/application/attendance-time-confirmation"

const TZ = "Asia/Bangkok"
const at = (hhmm: string) => new Date(`2026-10-18T${hhmm}:00.000Z`)

describe("effectiveDayTimes", () => {
  it("uses the scan times when there is no confirmation", () => {
    const times = effectiveDayTimes(at("01:30"), at("10:00"), null)
    expect(times.confirmed).toBe(false)
    expect(times.scanChanged).toBe(false)
    expect(summarizeManHour(times.firstIn!, times.lastOut, TZ).manMinutes).toBe(7 * 60 + 30)
  })

  it("uses a confirmed 08:00-17:00 as a full day even when the scan was late or missing", () => {
    const confirmation = {
      confirmedIn: at("01:00"),
      confirmedOut: at("10:00"),
      sourceFirstIn: at("01:30"),
      sourceLastOut: at("10:00"),
    }
    const late = effectiveDayTimes(at("01:30"), at("10:00"), confirmation)
    const missing = effectiveDayTimes(null, null, { ...confirmation, sourceFirstIn: null, sourceLastOut: null })
    expect(summarizeManHour(late.firstIn!, late.lastOut, TZ).manMinutes).toBe(480)
    expect(summarizeManHour(missing.firstIn!, missing.lastOut, TZ).manMinutes).toBe(480)
    expect(late.scanChanged).toBe(false)
    expect(missing.confirmed).toBe(true)
  })

  it("keeps a confirmed clock-in when the clock-out is still empty", () => {
    const times = effectiveDayTimes(null, null, {
      confirmedIn: at("01:00"),
      confirmedOut: null,
      sourceFirstIn: null,
      sourceLastOut: null,
    })
    expect(times.confirmed).toBe(true)
    expect(times.firstIn).toEqual(at("01:00"))
    expect(times.lastOut).toBeNull()
    expect(summarizeManHour(times.firstIn!, times.lastOut, TZ).lateMinutes).toBe(0)
  })

  it("keeps the confirmation and flags a scan that arrived afterwards", () => {
    const times = effectiveDayTimes(at("01:40"), at("10:20"), {
      confirmedIn: at("01:00"),
      confirmedOut: at("10:00"),
      sourceFirstIn: at("01:30"),
      sourceLastOut: at("10:00"),
    })
    expect(times.scanChanged).toBe(true)
    expect(times.confirmed).toBe(true)
    expect(times.firstIn).toEqual(at("01:00"))
    expect(summarizeManHour(times.firstIn!, times.lastOut, TZ).manMinutes).toBe(480)
  })
})
