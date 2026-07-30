import { describe, expect, it } from "vitest"
import {
  DEFAULT_WHEEL_LAYOUTS,
  getDefaultWheelLayout,
  isValidWheelPosition,
  validateWheelLayoutAgainstCount,
  VEHICLE_WHEEL_COUNTS,
} from "../vehicle-wheel-layouts"

describe("vehicle-wheel-layouts", () => {
  it("defaults cover every allowed wheel count exactly", () => {
    for (const count of VEHICLE_WHEEL_COUNTS) {
      const layout = DEFAULT_WHEEL_LAYOUTS[count]
      const result = validateWheelLayoutAgainstCount(layout, count)
      expect(result.ok).toBe(true)
      expect(getDefaultWheelLayout(count).flat()).toHaveLength(count)
    }
  })

  it("accepts an alternate 12-wheel layout", () => {
    const alt = [
      [1, 2],
      [3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
    ]
    const result = validateWheelLayoutAgainstCount(alt, 12)
    expect(result.ok).toBe(true)
  })

  it("rejects duplicate or incomplete layouts", () => {
    expect(validateWheelLayoutAgainstCount([[1, 2], [3, 3]], 4).ok).toBe(false)
    expect(validateWheelLayoutAgainstCount([[1, 2], [3]], 4).ok).toBe(false)
    expect(validateWheelLayoutAgainstCount([[1, 2], [3, 4, 5]], 4).ok).toBe(false)
  })

  it("checks positions against layout", () => {
    const layout = getDefaultWheelLayout(22)
    expect(isValidWheelPosition(layout, 1)).toBe(true)
    expect(isValidWheelPosition(layout, 22)).toBe(true)
    expect(isValidWheelPosition(layout, 23)).toBe(false)
  })
})
