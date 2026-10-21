import { describe, expect, it } from "vitest"
import { compareBranchTabName } from "@/modules/hr/application/branch-tab-order"

describe("branch tab order", () => {
  it("puts the company branches in the agreed order", () => {
    const names = ["สุราษฎร์ธานี", "โคราช", "โรงเหล็ก", "สำนักงาน", "พระประแดง", "โรงกระดาษ"]
    expect([...names].sort(compareBranchTabName)).toEqual([
      "โรงกระดาษ",
      "โรงเหล็ก",
      "พระประแดง",
      "โคราช",
      "สุราษฎร์ธานี",
      "สำนักงาน",
    ])
  })
})
