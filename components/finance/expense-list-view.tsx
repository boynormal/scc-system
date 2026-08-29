"use client"

import { Suspense } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { FinancePageHeader } from "./finance-page-header"
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
    <div className="space-y-6">
      <FinancePageHeader
        title="ค่าใช้จ่าย"
        description="บันทึกและติดตามค่าใช้จ่ายและต้นทุนทั้งหมด"
        actions={
          perms.canCreate ? (
            <Link
              href="/finance/expenses/new"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              บันทึกค่าใช้จ่าย
            </Link>
          ) : undefined
        }
      />
      <Suspense fallback={null}>
        <ExpenseList perms={perms} initialItems={initialItems} initialSummary={initialSummary} />
      </Suspense>
    </div>
  )
}
