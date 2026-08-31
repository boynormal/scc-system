import { describe, expect, it } from "vitest"
import {
  formatExpenseSourceOrigin,
  readableSourceReference,
  summarizeExpenseSourceOrigin,
} from "../expense-source-origin"

describe("readableSourceReference", () => {
  it("prefers operational document number over description", () => {
    expect(
      readableSourceReference({
        sourceDocumentNo: "TJ-2026-00002",
        description: "ลูกค้า A",
        costObjectType: "JOB",
        costObjectLabel: "TJ-2026-00002",
      })
    ).toBe("TJ-2026-00002")
  })

  it("prefers stored description over cost object", () => {
    expect(
      readableSourceReference({
        description: "ใบงาน JOB-12 — ลูกค้า A",
        costObjectType: "JOB",
        costObjectLabel: "JOB-12",
      })
    ).toBe("ใบงาน JOB-12 — ลูกค้า A")
  })

  it("falls back to cost object and skips UUID-only text", () => {
    expect(
      readableSourceReference({
        description: "3505169a-4c31-4681-b7f1-f2db18af58f4",
        costObjectType: "VEHICLE",
        costObjectLabel: "กข-1",
      })
    ).toBe("รถ กข-1")
  })
})

describe("formatExpenseSourceOrigin", () => {
  it("shows document type plus stored reference for an import line", () => {
    expect(
      formatExpenseSourceOrigin({
        sourceKind: "IMPORT",
        sourceModule: "TRANSPORT",
        sourceType: "TRANSPORT_REPAIR",
        description: "ค่าซ่อม: เครื่องไม่ติด",
        costObjectLabel: "กข-1",
      })
    ).toEqual({ kind: "ค่าซ่อม (ขนส่ง)", reference: "ค่าซ่อม: เครื่องไม่ติด" })
  })

  it("treats manual lines as บันทึกเอง without a reference", () => {
    expect(
      formatExpenseSourceOrigin({
        sourceKind: "MANUAL",
        sourceModule: null,
        sourceType: null,
        description: "ค่าทางด่วน",
      })
    ).toEqual({ kind: "บันทึกเอง", reference: null })
  })
})

describe("summarizeExpenseSourceOrigin", () => {
  it("summarizes one imported source for the bill header", () => {
    expect(
      summarizeExpenseSourceOrigin([
        {
          sourceKind: "IMPORT",
          sourceModule: "TRANSPORT",
          sourceType: "TRANSPORT_JOB",
          description: "ใบงาน JOB-1 — A",
        },
      ])
    ).toEqual({ kind: "ใบงานขนส่ง", reference: "ใบงาน JOB-1 — A" })
  })

  it("marks mixed manual and imported lines", () => {
    expect(
      summarizeExpenseSourceOrigin([
        {
          sourceKind: "IMPORT",
          sourceModule: "TRANSPORT",
          sourceType: "TRANSPORT_TIRE",
          description: "ค่ายาง",
        },
        { sourceKind: "MANUAL", description: "ค่าจอด" },
      ])
    ).toEqual({ kind: "ค่ายาง (ขนส่ง) + บันทึกเอง", reference: "ค่ายาง" })
  })
})
