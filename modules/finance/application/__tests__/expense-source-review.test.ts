import { describe, expect, it } from "vitest"
import {
  isOpenInReviewQueue,
  reviewBlocksCreate,
  shouldReopenReviewOnExpenseCancel,
  sourceReviewDocKey,
  sourceReviewKey,
} from "@/modules/finance/application/expense-source-review"

describe("sourceReviewKey", () => {
  it("uses a null line id for document-level sources", () => {
    expect(
      sourceReviewKey({ sourceType: "TRANSPORT_JOB", sourceDocumentId: "job-1", sourceLineId: null })
    ).toBe("TRANSPORT_JOB::job-1::")
    expect(sourceReviewDocKey({ sourceType: "TRANSPORT_JOB", sourceDocumentId: "job-1" })).toBe(
      "TRANSPORT_JOB::job-1"
    )
  })
})

describe("review queue status", () => {
  it("treats missing row and PENDING as open", () => {
    expect(isOpenInReviewQueue(null)).toBe(true)
    expect(isOpenInReviewQueue(undefined)).toBe(true)
    expect(isOpenInReviewQueue("PENDING")).toBe(true)
    expect(isOpenInReviewQueue("NO_EXPENSE")).toBe(false)
    expect(isOpenInReviewQueue("EXPENSE_CREATED")).toBe(false)
  })

  it("blocks create for NO_EXPENSE and EXPENSE_CREATED", () => {
    expect(reviewBlocksCreate("NO_EXPENSE")).toBe(true)
    expect(reviewBlocksCreate("EXPENSE_CREATED")).toBe(true)
    expect(reviewBlocksCreate("PENDING")).toBe(false)
    expect(reviewBlocksCreate(null)).toBe(false)
  })

  it("reopens only EXPENSE_CREATED after expense cancel", () => {
    expect(shouldReopenReviewOnExpenseCancel("EXPENSE_CREATED")).toBe(true)
    expect(shouldReopenReviewOnExpenseCancel("NO_EXPENSE")).toBe(false)
    expect(shouldReopenReviewOnExpenseCancel("PENDING")).toBe(false)
    expect(shouldReopenReviewOnExpenseCancel(null)).toBe(false)
  })
})
