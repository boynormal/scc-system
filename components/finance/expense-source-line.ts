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

/** A purchase order becomes one bill line per PO line; finance still picks the expense type on each. */
function purchaseOrderToLines(row: ExpenseSourceRow): LineDraft[] {
  return (row.lines ?? []).map((l) => {
    const qtyPrice = Boolean(l.unitId)
    return {
      key: `${rowKey(row)}-${l.id}`,
      expenseTypeId: "",
      description: l.description,
      pricingMode: qtyPrice ? "QTY_PRICE" : "AMOUNT",
      quantity: qtyPrice ? String(l.quantity) : "1",
      unitId: l.unitId ?? "",
      unitCode: l.unitCode ?? "",
      unitPrice: qtyPrice ? String(l.unitPrice) : String(l.amount),
      amount: String(l.amount),
      taxAmount: "",
      taxMode: "NONE",
      discountAmount: "",
      discountKind: "BAHT",
      costCenterId: "",
      costObjectType: "",
      costObjectId: "",
      costObjectLabel: "",
      sourceKind: row.sourceKind,
      sourceModule: row.sourceModule,
      sourceType: row.sourceType,
      sourceDocumentId: row.sourceDocumentId,
      sourceLineId: l.id,
      sourceAmountLocked: l.amount > 0,
    }
  })
}

export function sourceToLines(row: ExpenseSourceRow): LineDraft[] {
  return row.sourceModule === "PROCUREMENT" ? purchaseOrderToLines(row) : [sourceToLine(row)]
}
