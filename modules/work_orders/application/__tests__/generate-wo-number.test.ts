import type { PrismaClient } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"
import { generateWONumber } from "@/modules/work_orders/application/generate-wo-number"

function createMockDb(count: number) {
  const db = {
    workOrder: { count: vi.fn().mockResolvedValue(count) },
  }
  return { db, asDb: () => db as unknown as Pick<PrismaClient, "workOrder"> }
}

describe("generateWONumber", () => {
  it("generates WO-{year}-00001 when no existing WO for the branch/year", async () => {
    const { asDb } = createMockDb(0)
    const year = new Date().getFullYear()

    const result = await generateWONumber(asDb(), "branch-1")

    expect(result).toBe(`WO-${year}-00001`)
  })

  it("increments and pads based on existing count", async () => {
    const { asDb } = createMockDb(41)
    const year = new Date().getFullYear()

    const result = await generateWONumber(asDb(), "branch-1")

    expect(result).toBe(`WO-${year}-00042`)
  })

  it("scopes the count query by branchId and the current-year prefix", async () => {
    const { db, asDb } = createMockDb(0)
    const year = new Date().getFullYear()

    await generateWONumber(asDb(), "branch-42")

    expect(db.workOrder.count).toHaveBeenCalledWith({
      where: { branchId: "branch-42", woNumber: { startsWith: `WO-${year}-` } },
    })
  })
})
