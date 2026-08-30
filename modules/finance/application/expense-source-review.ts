export const FINANCE_SOURCE_REVIEW_STATUSES = ["PENDING", "EXPENSE_CREATED", "NO_EXPENSE"] as const
export type FinanceSourceReviewStatus = (typeof FINANCE_SOURCE_REVIEW_STATUSES)[number]

export type SourceReviewIdentity = {
  sourceModule: string
  sourceType: string | null
  sourceDocumentId: string
  sourceLineId: string | null
}

export function sourceReviewKey(identity: {
  sourceType: string | null
  sourceDocumentId: string
  sourceLineId?: string | null
}): string {
  return `${identity.sourceType ?? ""}::${identity.sourceDocumentId}::${identity.sourceLineId ?? ""}`
}

/** Document-level identity for the Transport queue (1 source = 1 document). */
export function sourceReviewDocKey(identity: {
  sourceType: string | null
  sourceDocumentId: string
}): string {
  return `${identity.sourceType ?? ""}::${identity.sourceDocumentId}`
}

/** Queue shows implicit PENDING (no row) and explicit PENDING. */
export function isOpenInReviewQueue(status: FinanceSourceReviewStatus | null | undefined): boolean {
  return status == null || status === "PENDING"
}

export function reviewBlocksCreate(status: FinanceSourceReviewStatus | null | undefined): boolean {
  return status === "NO_EXPENSE" || status === "EXPENSE_CREATED"
}

/** Auto-reopen only EXPENSE_CREATED after cancel/soft-delete of that bill. */
export function shouldReopenReviewOnExpenseCancel(
  status: FinanceSourceReviewStatus | null | undefined
): boolean {
  return status === "EXPENSE_CREATED"
}

export function toReviewIdentity(identity: SourceReviewIdentity): SourceReviewIdentity {
  return {
    sourceModule: identity.sourceModule,
    sourceType: identity.sourceType,
    sourceDocumentId: identity.sourceDocumentId,
    sourceLineId: identity.sourceLineId ?? null,
  }
}
