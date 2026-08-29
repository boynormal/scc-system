"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Receipt, Search } from "lucide-react"
import { Select } from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import {
  GlassCard,
  GlassStatCard,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"
import type {
  CostCenterRow,
  ExpenseDto,
  ExpenseSummary,
  ExpenseTypeOption,
  FinancePerms,
  Option,
} from "./expense-types"
import {
  EXPENSE_STATUS_BADGE,
  EXPENSE_STATUS_LABELS,
  FIN_GLASS_FIELD,
  FIN_GLASS_PANEL,
  formatBaht,
  sourceModuleLabel,
  type ExpenseStatus,
} from "./finance-theme"
import { ExpenseStatusBadge } from "./finance-page-header"

const STAT_CARDS: { status: ExpenseStatus; hint: string }[] = [
  { status: "DRAFT", hint: "ยังไม่ส่ง" },
  { status: "PENDING", hint: "รออนุมัติ" },
  { status: "APPROVED", hint: "พร้อมจ่าย" },
  { status: "PAID", hint: "จ่ายแล้ว" },
]

export function ExpenseList({
  perms,
  initialItems,
  initialSummary,
}: {
  perms: FinancePerms
  initialItems: ExpenseDto[]
  initialSummary: ExpenseSummary
}) {
  const router = useRouter()
  const [items, setItems] = useState<ExpenseDto[]>(initialItems)
  const [summary, setSummary] = useState<ExpenseSummary>(initialSummary)
  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<ExpenseTypeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [branchId, setBranchId] = useState("")
  const [expenseTypeId, setExpenseTypeId] = useState("")
  const [costCenterId, setCostCenterId] = useState("")
  const [status, setStatus] = useState("")
  const [search, setSearch] = useState("")

  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/branches", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/expense-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, t, c]) => {
        setBranches((b.data ?? []) as Option[])
        setTypes((t.data ?? []) as ExpenseTypeOption[])
        setCostCenters((c.data ?? []) as CostCenterRow[])
      })
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (branchId) params.set("branchId", branchId)
    if (expenseTypeId) params.set("expenseTypeId", expenseTypeId)
    if (costCenterId) params.set("costCenterId", costCenterId)
    if (status) params.set("status", status)
    if (search.trim()) params.set("search", search.trim())
    const summaryParams = new URLSearchParams()
    if (branchId) summaryParams.set("branchId", branchId)

    try {
      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/finance/expenses?${params}`, { cache: "no-store" }),
        fetch(`/api/finance/expenses/summary?${summaryParams}`, { cache: "no-store" }),
      ])
      const json = await listRes.json().catch(() => ({}))
      const summaryJson = await summaryRes.json().catch(() => ({}))
      if (!listRes.ok) {
        setError("โหลดข้อมูลไม่สำเร็จ")
        return
      }
      setError(null)
      setItems((json.data ?? []) as ExpenseDto[])
      if (summaryRes.ok && summaryJson.counts) setSummary(summaryJson as ExpenseSummary)
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ")
    }
  }, [branchId, expenseTypeId, costCenterId, status, search])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refetch = () => void load()
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refetch()
    }
    window.addEventListener("focus", refetch)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.removeEventListener("focus", refetch)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [load])

  function toggleStatus(next: ExpenseStatus) {
    setStatus((current) => (current === next ? "" : next))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <button
            key={card.status}
            type="button"
            onClick={() => toggleStatus(card.status)}
            className={cn(
              "text-left transition",
              status === card.status && "rounded-glass ring-2 ring-emerald-400"
            )}
          >
            <GlassStatCard
              label={EXPENSE_STATUS_LABELS[card.status]}
              value={String(summary.counts[card.status])}
              hint={`${card.hint} · ${formatBaht(summary.totals[card.status])}`}
              icon={Receipt}
              className={FIN_GLASS_PANEL}
            />
          </button>
        ))}
      </div>

      <GlassCard className={cn("flex flex-wrap items-end gap-3 rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
        <Select
          label="สาขา"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
          options={[{ value: "", label: "ทั้งหมด" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
        />
        <Select
          label="ประเภท"
          value={expenseTypeId}
          onChange={(e) => setExpenseTypeId(e.target.value)}
          className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
          options={[{ value: "", label: "ทั้งหมด" }, ...types.map((t) => ({ value: t.id, label: t.name }))]}
        />
        <Select
          label="หน่วยงาน"
          value={costCenterId}
          onChange={(e) => setCostCenterId(e.target.value)}
          className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
          options={[
            { value: "", label: "ทั้งหมด" },
            ...costCenters.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          label="สถานะ"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
          options={[
            { value: "", label: "ทั้งหมด" },
            ...(Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).map((s) => ({
              value: s,
              label: EXPENSE_STATUS_LABELS[s],
            })),
          ]}
        />
        <label className="min-w-[14rem] flex-1 space-y-1.5 text-sm">
          <span className="font-medium text-foreground">ค้นหา</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn("block w-full rounded-lg border py-2 pl-9 pr-3 text-sm", FIN_GLASS_FIELD)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="เลขที่ / รายละเอียด / วัตถุต้นทุน"
            />
          </span>
        </label>
      </GlassCard>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.length === 0 && !error ? (
        <GlassCard className={cn("flex flex-col items-center justify-center py-12 text-center", FIN_GLASS_PANEL)}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 backdrop-blur-sm dark:bg-emerald-400/15 dark:text-emerald-200">
            <Receipt className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-medium text-foreground">ยังไม่มีรายการค่าใช้จ่าย</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            เริ่มบันทึกค่าใช้จ่าย หรือผูกจากเอกสารต้นทางในแท็บ &ldquo;ผูกจากต้นทาง&rdquo;
          </p>
          {perms.canCreate && (
            <Link
              href="/finance/expenses/new"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              บันทึกค่าใช้จ่าย
            </Link>
          )}
        </GlassCard>
      ) : (
        <GlassTable className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
          <GlassTableHeader className="border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <tr>
              <GlassTableHead className="w-[14%] whitespace-nowrap">เลขที่</GlassTableHead>
              <GlassTableHead className="w-[10%] whitespace-nowrap">วันที่</GlassTableHead>
              <GlassTableHead className="w-[16%]">ประเภท</GlassTableHead>
              <GlassTableHead className="w-[12%] whitespace-nowrap">ต้นทาง</GlassTableHead>
              <GlassTableHead className="w-[16%]">หน่วยงาน</GlassTableHead>
              <GlassTableHead className="w-[14%] whitespace-nowrap text-right">ยอดสุทธิ</GlassTableHead>
              <GlassTableHead className="w-[10%] whitespace-nowrap">สถานะ</GlassTableHead>
            </tr>
          </GlassTableHeader>
          <GlassTableBody>
            {items.map((item) => (
              <GlassTableRow
                key={item.id}
                className="cursor-pointer bg-white/50 hover:bg-white/80 dark:bg-transparent dark:hover:bg-white/5"
                onClick={() => router.push(`/finance/expenses/${item.id}`)}
              >
                <GlassTableCell className="whitespace-nowrap font-medium text-foreground">
                  {item.expenseNo}
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatDate(item.expenseDate)}
                </GlassTableCell>
                <GlassTableCell>
                  <span className="block truncate" title={item.expenseTypeName}>
                    {item.expenseTypeName}
                    {item.lineCount > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">+ อีก {item.lineCount - 1}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground" title={item.branchName}>
                    {item.branchName}
                  </span>
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap text-muted-foreground">
                  {sourceModuleLabel(item.sourceModule)}
                </GlassTableCell>
                <GlassTableCell className="text-muted-foreground">
                  {item.costCenterName ?? "—"}
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-foreground">
                  {formatBaht(item.netAmount)}
                </GlassTableCell>
                <GlassTableCell className="whitespace-nowrap">
                  <ExpenseStatusBadge
                    label={EXPENSE_STATUS_LABELS[item.status]}
                    className={EXPENSE_STATUS_BADGE[item.status]}
                  />
                </GlassTableCell>
              </GlassTableRow>
            ))}
          </GlassTableBody>
        </GlassTable>
      )}
    </div>
  )
}
