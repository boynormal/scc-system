import { describe, expect, it } from "vitest"
import { metalBahtPerKg, metalMassUnit } from "@/modules/raw_material_news/application/metal-baht-per-kg"

describe("metalBahtPerKg", () => {
  it("converts a metric-ton copper quote to baht per kilogram", () => {
    expect(metalBahtPerKg("ทองแดง", 14246.63, 33)).toBeCloseTo(470.13879, 4)
  })

  it("treats the cheap copper contract as pounds and the expensive one as tons", () => {
    expect(metalMassUnit("Copper", 6.5095)).toBe("pound")
    expect(metalMassUnit("ทองแดง", 14246.63)).toBe("metricTon")
    expect(metalBahtPerKg("Copper", 6.5095, 33.608)).toBeCloseTo((6.5095 * 33.608) / 0.453592, 4)
    expect(metalBahtPerKg("ทองแดง", 14246.63, 33.608)).toBeCloseTo((14246.63 * 33.608) / 1000, 4)
  })

  it("uses troy ounces for gold and does not confuse it with platinum", () => {
    expect(metalMassUnit("ทองคำ", 3962.07)).toBe("troyOz")
    expect(metalMassUnit("ทองคำขาว", 1456.85)).toBe("troyOz")
    expect(metalBahtPerKg("Gold", 3962.07, 33)).toBeCloseTo((3962.07 * 33) / (31.1035 / 1000), 2)
  })

  it("returns null when the metal or the exchange rate is unusable", () => {
    expect(metalBahtPerKg("กาแฟ", 100, 33)).toBeNull()
    expect(metalBahtPerKg("ดีบุก", 49706, 0)).toBeNull()
  })
})
