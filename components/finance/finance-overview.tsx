"use client"

import { useEffect, useState } from "react"
import { CircleDollarSign, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"
import { GlassCard, GlassStatCard } from "@/components/glass"
import { FinancePageHeader } from "./finance-page-header"
import {
  EXPENSE_STATUS_LABELS,
  FIN_GLASS_PANEL,
  formatBaht,
  type ExpenseStatus,
} from "./finance-theme"
import type { ExpenseSummary } from "./expense-types"

const EMPTY: ExpenseSummary = {
  counts: { DRAFT: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0, CANCELLED: 0 },
  totals: { DRAFT: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0, CANCELLED: 0 },
}

const CARDS: ExpenseStatus[] = ["DRAFT", "PENDING", "APPROVED", "PAID"]

export function FinanceOverview() {
  const [summary, setSummary] = useState<ExpenseSummary>(EMPTY)

  useEffect(() => {
    void fetch("/api/finance/expenses/summary")
      .then((r) => r.json())
      .then((j) => {
        if (j?.counts) setSummary(j as ExpenseSummary)
      })
      .catch(() => undefined)
  }, [])

  const outstanding =
    summary.totals.DRAFT + summary.totals.PENDING + summary.totals.APPROVED
  const totalCount = CARDS.reduce((sum, s) => sum + summary.counts[s], 0)

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="การเงินและบัญชี"
        description="ภาพรวมค่าใช้จ่ายและต้นทุน — เฟส 1"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CARDS.map((s) => (
          <GlassStatCard
            key={s}
            label={EXPENSE_STATUS_LABELS[s]}
            value={String(summary.counts[s])}
            hint={formatBaht(summary.totals[s])}
            icon={Receipt}
            className={FIN_GLASS_PANEL}
          />
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ยอดค้างจ่าย (ยังไม่จ่าย)
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatBaht(outstanding)}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <Receipt className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                จ่ายแล้วสะสม
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatBaht(summary.totals.PAID)}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <p className="text-sm text-muted-foreground">
        รวม {totalCount} รายการที่กำลังดำเนินการ · ดูรายละเอียดในแท็บ &ldquo;ค่าใช้จ่าย&rdquo; และ &ldquo;รายงาน&rdquo;
      </p>
    </div>
  )
}
