import { describe, expect, it, vi } from "vitest"
import { generateWONumber } from "@/modules/work_orders/application/generate-wo-number"

function createMockDb(count: number) {
  return {
    workOrder: { count: vi.fn().mockResolvedValue(count) },
  }
}

describe("generateWONumber", () => {
  it("generates WO-{year}-00001 when no existing WO for the branch/year", async () => {
    const db = createMockDb(0)
    const year = new Date().getFullYear()

    const result = await generateWONumber(db, "branch-1")

    expect(result).toBe(`WO-${year}-00001`)
  })

  it("increments and pads based on existing count", async () => {
    const db = createMockDb(41)
    const year = new Date().getFullYear()

    const result = await generateWONumber(db, "branch-1")

    expect(result).toBe(`WO-${year}-00042`)
  })

  it("scopes the count query by branchId and the current-year prefix", async () => {
    const db = createMockDb(0)
    const year = new Date().getFullYear()

    await generateWONumber(db, "branch-42")

    expect(db.workOrder.count).toHaveBeenCalledWith({
      where: { branchId: "branch-42", woNumber: { startsWith: `WO-${year}-` } },
    })
  })
})
