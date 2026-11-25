import { describe, expect, it } from "vitest"
import {
  assertTransition,
  attachmentSlotsLeft,
  canChangeAttachments,
  MAX_PURCHASE_ATTACHMENTS,
  canTransition,
  formatPoNo,
  isEditableStatus,
  lineAmount,
  poNoPrefix,
  sumLines,
  type TransitionCheck,
} from "../po-rules"

function check(over: Partial<TransitionCheck>): TransitionCheck {
  return { from: "DRAFT", to: "ORDERED", lineCount: 1, ...over }
}

describe("canTransition", () => {
  it("allows the forward path and going back from ordered to draft", () => {
    expect(canTransition("DRAFT", "ORDERED")).toBe(true)
    expect(canTransition("ORDERED", "RECEIVED")).toBe(true)
    expect(canTransition("ORDERED", "DRAFT")).toBe(true)
    expect(canTransition("DRAFT", "CANCELLED")).toBe(true)
    expect(canTransition("ORDERED", "CANCELLED")).toBe(true)
  })

  it("never leaves RECEIVED or CANCELLED, and cannot skip ordering", () => {
    expect(canTransition("DRAFT", "RECEIVED")).toBe(false)
    for (const to of ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const) {
      expect(canTransition("RECEIVED", to)).toBe(false)
      expect(canTransition("CANCELLED", to)).toBe(false)
    }
  })
})

describe("assertTransition", () => {
  it("needs at least one line to order or receive", () => {
    expect(() => assertTransition(check({ lineCount: 0 }))).toThrow("อย่างน้อย 1 รายการ")
    expect(() => assertTransition(check({ from: "ORDERED", to: "RECEIVED", lineCount: 0 }))).toThrow("อย่างน้อย 1 รายการ")
  })

  it("lets an order be received without a photo", () => {
    expect(() => assertTransition(check({ from: "ORDERED", to: "RECEIVED" }))).not.toThrow()
  })

  it("needs a reason to cancel", () => {
    expect(() => assertTransition(check({ to: "CANCELLED", reason: "  " }))).toThrow("เหตุผล")
    expect(() => assertTransition(check({ to: "CANCELLED", reason: "ผู้ขายไม่มีของ", lineCount: 0 }))).not.toThrow()
  })

  it("rejects transitions that are not allowed", () => {
    expect(() => assertTransition(check({ from: "RECEIVED", to: "DRAFT" }))).toThrow("เปลี่ยนสถานะนี้ไม่ได้")
  })
})

describe("status helpers", () => {
  it("edits lines only in draft and photos until received", () => {
    expect(isEditableStatus("DRAFT")).toBe(true)
    expect(isEditableStatus("ORDERED")).toBe(false)
    expect(canChangeAttachments("ORDERED")).toBe(true)
    expect(canChangeAttachments("RECEIVED")).toBe(false)
    expect(canChangeAttachments("CANCELLED")).toBe(false)
  })

  it("leaves room for up to 10 photos", () => {
    expect(MAX_PURCHASE_ATTACHMENTS).toBe(10)
    expect(attachmentSlotsLeft(0)).toBe(10)
    expect(attachmentSlotsLeft(8)).toBe(2)
    expect(attachmentSlotsLeft(10)).toBe(0)
    expect(attachmentSlotsLeft(12)).toBe(0)
  })
})

describe("amounts and numbering", () => {
  it("rounds line and total amounts to 2 decimals", () => {
    expect(lineAmount(3, 33.333)).toBe(100)
    expect(lineAmount(1.5, 10.01)).toBe(15.02)
    expect(sumLines([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3)
  })

  it("formats PO-YYYYMM-NNNN", () => {
    const now = new Date(2026, 10, 23)
    expect(formatPoNo(now, 0)).toBe("PO-202611-0001")
    expect(formatPoNo(now, 41)).toBe("PO-202611-0042")
    expect(poNoPrefix(now)).toBe("PO-202611-")
  })
})
