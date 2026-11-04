import { describe, expect, it } from "vitest"
import { appendJobStop } from "../job-stop-order"

describe("appendJobStop", () => {
  it("keeps the existing stop at sequence 1 and appends the new stop as sequence 2", () => {
    const existing = {
      sequence: 1,
      id: "stop-1",
      customerName: "จุดเดิม",
      address: "ที่อยู่เดิม",
    }
    const blank = { sequence: 1, customerName: "", address: "" }

    const next = appendJobStop([existing], blank)

    expect(next).toHaveLength(2)
    expect(next[0]).toEqual({
      sequence: 1,
      id: "stop-1",
      customerName: "จุดเดิม",
      address: "ที่อยู่เดิม",
    })
    expect(next[1]).toEqual({ sequence: 2, customerName: "", address: "" })
  })

  it("creates the first stop when the list is empty", () => {
    expect(appendJobStop([], { sequence: 1, customerName: "" })).toEqual([
      { sequence: 1, customerName: "" },
    ])
  })
})
