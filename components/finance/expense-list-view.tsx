"use client"

import { Suspense } from "react"
import { ExpenseList } from "./expense-list"
import type { ExpenseDto, ExpenseSummary, FinancePerms } from "./expense-types"

export function ExpenseListView({
  perms,
  initialItems,
  initialSummary,
}: {
  perms: FinancePerms
  initialItems: ExpenseDto[]
  initialSummary: ExpenseSummary
}) {
  return (
    <Suspense fallback={null}>
      <ExpenseList perms={perms} initialItems={initialItems} initialSummary={initialSummary} />
    </Suspense>
  )
}
