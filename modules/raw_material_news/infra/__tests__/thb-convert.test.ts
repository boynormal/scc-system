import { describe, expect, it } from "vitest"
import {
  cnyThbForDate,
  rmbTonToThb,
  toThbPerKg,
  toThbPerTon,
  usdThbForDate,
  usdToThb,
} from "@/modules/raw_material_news/infra/thb-convert"

describe("thb-convert", () => {
  it("converts RMB/ton to THB/ton and THB/kg", () => {
    const cnyThb = 4.7
    const thbPerTon = toThbPerTon(1998, cnyThb)
    expect(thbPerTon).toBeCloseTo(9390.6, 5)
    expect(toThbPerKg(thbPerTon)).toBeCloseTo(9.3906, 5)
    expect(rmbTonToThb(1998, cnyThb)).toEqual({
      thbPerTon: 1998 * 4.7,
      thbPerKg: (1998 * 4.7) / 1000,
    })
  })

  it("returns null when FX is missing", () => {
    expect(rmbTonToThb(1998, null)).toBeNull()
    expect(rmbTonToThb(1998, undefined)).toBeNull()
  })

  it("uses the matching date rate then falls back to latest", () => {
    const history = [
      { date: "2026-08-10", cnyThb: 4.6 },
      { date: "2026-08-12", cnyThb: 4.72 },
    ]
    expect(cnyThbForDate("2026-08-12", history, 4.7)).toBe(4.72)
    expect(cnyThbForDate("2026-08-01", history, 4.7)).toBe(4.7)
    expect(cnyThbForDate("2026-08-01", history, null)).toBeNull()
  })

  it("converts USD freight to THB per FEU", () => {
    expect(usdToThb(373.8, 32.5)).toBeCloseTo(12148.5, 5)
  })

  it("returns null when USD/THB is missing", () => {
    expect(usdToThb(373.8, null)).toBeNull()
    expect(usdToThb(373.8, undefined)).toBeNull()
  })

  it("uses the matching USD/THB date rate then falls back to latest", () => {
    const history = [
      { date: "2026-08-07", usdThb: 32.4 },
      { date: "2026-08-12", usdThb: 32.6 },
    ]
    expect(usdThbForDate("2026-08-07", history, 32.5)).toBe(32.4)
    expect(usdThbForDate("2026-05-15", history, 32.5)).toBe(32.5)
    expect(usdThbForDate("2026-05-15", history, null)).toBeNull()
  })
})
