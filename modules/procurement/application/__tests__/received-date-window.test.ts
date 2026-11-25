import { describe, expect, it } from "vitest"
import { receivedDateWindow, receivedRangeRequested } from "../purchase-order-service"

describe("receivedRangeRequested", () => {
  it("stays off until a real date is sent, so the received tab keeps the open finance queue", () => {
    expect(receivedRangeRequested(null, null)).toBe(false)
    expect(receivedRangeRequested("", "")).toBe(false)
    expect(receivedRangeRequested("soon", "later")).toBe(false)
    expect(receivedRangeRequested("2026-11-01", null)).toBe(true)
  })
})

describe("receivedDateWindow", () => {
  const now = new Date("2026-11-25T08:00:00+07:00")

  it("defaults to the 15 Bangkok days before today through today", () => {
    const window = receivedDateWindow(null, null, now)
    expect(window.from).toBe("2026-11-10")
    expect(window.to).toBe("2026-11-25")
    expect(window.start.toISOString()).toBe("2026-11-09T17:00:00.000Z")
    expect(window.end.toISOString()).toBe("2026-11-25T16:59:59.999Z")
  })

  it("keeps an explicit range and swaps reversed ends", () => {
    expect(receivedDateWindow("2026-11-01", "2026-11-05", now)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-05",
    })
    expect(receivedDateWindow("2026-11-05", "2026-11-01", now)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-05",
    })
  })
})
