import { describe, expect, it } from "vitest"
import { isPlainLeftClick, isSameDestination, nextPendingKey } from "@/components/shell/nav-pending-utils"

const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

describe("isPlainLeftClick", () => {
  it("accepts an ordinary left click", () => {
    expect(isPlainLeftClick(plain)).toBe(true)
    expect(isPlainLeftClick(plain, "_self")).toBe(true)
    expect(isPlainLeftClick(plain, "")).toBe(true)
  })

  it("leaves modifier, middle, and new-tab clicks to the browser", () => {
    expect(isPlainLeftClick({ ...plain, metaKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, ctrlKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, shiftKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, altKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, button: 1 })).toBe(false)
    expect(isPlainLeftClick(plain, "_blank")).toBe(false)
    expect(isPlainLeftClick({ ...plain, defaultPrevented: true })).toBe(false)
  })
})

describe("isSameDestination", () => {
  it("matches the path and query regardless of parameter order", () => {
    expect(isSameDestination("/hr/personnel", "/hr/personnel", "")).toBe(true)
    expect(isSameDestination("/hr/personnel?branchId=1", "/hr/personnel", "?branchId=1")).toBe(true)
    expect(isSameDestination("/hr/personnel?a=1&b=2", "/hr/personnel", "b=2&a=1")).toBe(true)
  })

  it("rejects a different path or query", () => {
    expect(isSameDestination("/finance", "/finance/expenses", "")).toBe(false)
    expect(isSameDestination("/hr/personnel?branchId=1", "/hr/personnel", "?branchId=2")).toBe(false)
    expect(isSameDestination("/hr/attendance", "/hr/attendance/extra", "")).toBe(false)
  })
})

describe("nextPendingKey", () => {
  it("keeps a key that was set before navigation is flagged", () => {
    expect(
      nextPendingKey({ pendingKey: "b", activeKey: "a", navigating: false, wasNavigating: false })
    ).toBe("b")
  })

  it("keeps the clicked key while navigation is in flight, even if the route moves through another tab", () => {
    expect(
      nextPendingKey({ pendingKey: "b", activeKey: "c", navigating: true, wasNavigating: true })
    ).toBe("b")
  })

  it("clears when the route catches up or the navigation ends", () => {
    expect(
      nextPendingKey({ pendingKey: "b", activeKey: "b", navigating: false, wasNavigating: true })
    ).toBeNull()
    expect(
      nextPendingKey({ pendingKey: "b", activeKey: "a", navigating: false, wasNavigating: true })
    ).toBeNull()
  })

  it("clears on a route change when no provider is mounted", () => {
    expect(
      nextPendingKey({ pendingKey: "b", activeKey: "c", navigating: null, wasNavigating: false })
    ).toBeNull()
  })
})
