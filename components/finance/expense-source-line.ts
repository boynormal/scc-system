import type { ExpenseSourceRow, LineDraft } from "./expense-types"

export function rowKey(row: ExpenseSourceRow) {
  return `${row.sourceType}-${row.sourceId}`
}

/** The cost object is the vehicle's linked asset only; job and vehicle ids stay out of it. */
export function sourceToLine(row: ExpenseSourceRow): LineDraft {
  const locked = row.amount != null && row.amount > 0
  return {
    key: rowKey(row),
    expenseTypeId: "",
    description: row.description ?? "",
    pricingMode: "AMOUNT",
    quantity: "1",
    unitId: "",
    unitCode: "",
    unitPrice: locked ? String(row.amount) : "",
    amount: locked ? String(row.amount) : "",
    taxAmount: "",
    taxMode: "NONE",
    discountAmount: "",
    discountKind: "BAHT",
    costCenterId: "",
    costObjectType: row.assetId ? "VEHICLE" : "",
    costObjectId: row.assetId ?? "",
    costObjectLabel: row.assetId ? row.assetLabel ?? "" : "",
    sourceKind: row.sourceKind,
    sourceModule: row.sourceModule,
    sourceType: row.sourceType,
    sourceDocumentId: row.sourceDocumentId,
    sourceLineId: row.sourceLineId,
    sourceAmountLocked: locked,
  }
}
