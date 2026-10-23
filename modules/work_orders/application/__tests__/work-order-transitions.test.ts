import { describe, expect, it } from "vitest"
import { evaluateTransition } from "@/modules/work_orders/application/work-order-transitions"

describe("evaluateTransition", () => {
  it("requires an assignee to leave open", () => {
    expect(evaluateTransition({ from: "open", to: "assigned", hasApprove: true }).ok).toBe(false)
  })

  it("requires a hold reason", () => {
    const result = evaluateTransition({ from: "in_progress", to: "on_hold", hasApprove: false, reason: "nope" })
    expect(result).toEqual({ ok: false, message: "ต้องระบุเหตุผลการรอ" })
  })

  it("requires approve to close", () => {
    const result = evaluateTransition({ from: "handed_over", to: "closed", hasApprove: false })
    expect(result).toEqual({ ok: false, message: "ต้องมีสิทธิ์อนุมัติ" })
  })

  it("allows close when approve is present", () => {
    expect(evaluateTransition({ from: "handed_over", to: "closed", hasApprove: true }).ok).toBe(true)
  })

  it("requires a reason to send work back", () => {
    const result = evaluateTransition({ from: "ready_for_handover", to: "in_progress", hasApprove: false })
    expect(result).toEqual({ ok: false, message: "ต้องระบุเหตุผล" })
  })
})
