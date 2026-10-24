"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CircleDollarSign, HandCoins, Receipt, Wallet } from "lucide-react"
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
import { EMPTY_INCOME_SUMMARY, type IncomeSummary } from "./income-types"

const EMPTY: ExpenseSummary = {
  counts: { DRAFT: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0, CANCELLED: 0 },
  totals: { DRAFT: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0, CANCELLED: 0 },
}

const CARDS: ExpenseStatus[] = ["DRAFT", "PENDING", "APPROVED", "PAID"]

function TotalCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string
  value: number
  icon: typeof Receipt
  tone: "amber" | "emerald" | "sky"
  href?: string
}) {
  const toneClass = {
    amber: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
    emerald: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    sky: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  }[tone]
  const body = (
    <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL, href && "transition hover:ring-2 hover:ring-emerald-400")}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{formatBaht(value)}</p>
        </div>
      </div>
    </GlassCard>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export function FinanceOverview({
  canExpenses = true,
  canIncomes = false,
}: {
  canExpenses?: boolean
  canIncomes?: boolean
}) {
  const [summary, setSummary] = useState<ExpenseSummary>(EMPTY)
  const [income, setIncome] = useState<IncomeSummary>(EMPTY_INCOME_SUMMARY)

  useEffect(() => {
    if (canExpenses) {
      void fetch("/api/finance/expenses/summary")
        .then((r) => r.json())
        .then((j) => {
          if (j?.counts) setSummary(j as ExpenseSummary)
        })
        .catch(() => undefined)
    }
    if (canIncomes) {
      void fetch("/api/finance/incomes/summary")
        .then((r) => r.json())
        .then((j) => {
          if (j?.counts) setIncome(j as IncomeSummary)
        })
        .catch(() => undefined)
    }
  }, [canExpenses, canIncomes])

  const outstanding =
    summary.totals.DRAFT + summary.totals.PENDING + summary.totals.APPROVED
  const totalCount = CARDS.reduce((sum, s) => sum + summary.counts[s], 0)
  const incomeOutstanding = income.totals.DRAFT + income.totals.PENDING + income.totals.APPROVED

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="การเงินและบัญชี"
        description="ภาพรวมค่าใช้จ่าย รายรับ และต้นทุน"
      />

      {canExpenses && (
        <>
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
            <TotalCard label="ยอดค้างจ่าย (ยังไม่จ่าย)" value={outstanding} icon={CircleDollarSign} tone="amber" />
            <TotalCard label="จ่ายแล้วสะสม" value={summary.totals.PAID} icon={Receipt} tone="emerald" />
          </div>
        </>
      )}

      {canIncomes && (
        <div className="grid gap-3 md:grid-cols-2">
          <TotalCard
            label="รายรับค้างรับ (ยังไม่รับเงิน)"
            value={incomeOutstanding}
            icon={Wallet}
            tone="sky"
            href="/finance/incomes?status=APPROVED"
          />
          <TotalCard
            label="รับเงินแล้วสะสม"
            value={income.totals.RECEIVED}
            icon={HandCoins}
            tone="emerald"
            href="/finance/incomes?status=RECEIVED"
          />
        </div>
      )}

      {canExpenses && (
        <p className="text-sm text-muted-foreground">
          รวม {totalCount} รายการค่าใช้จ่ายที่กำลังดำเนินการ · ดูรายละเอียดในแท็บ &ldquo;ค่าใช้จ่าย&rdquo;
          {canIncomes ? <> &ldquo;รายรับ&rdquo;</> : null} และ &ldquo;รายงาน&rdquo;
        </p>
      )}
    </div>
  )
}
