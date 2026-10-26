"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Receipt, Search } from "lucide-react"
import { Select } from "@/components/ui/select"
import { cn, formatDate } from "@/lib/utils"
import { GlassCard } from "@/components/glass"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { SubTabs } from "@/components/shell/sub-tabs"
import { currentFinanceMonth, financeMonthRange, FinanceMonthPicker } from "./finance-month-picker"
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
  formatBaht,
  solidBlueButtonClass,
  sourceModuleLabel,
  type ExpenseStatus,
} from "./finance-theme"
import { surfaceFieldClass, surfacePanelClass } from "@/components/shell/surface"
import { ExpenseStatusBadge } from "./finance-page-header"

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
  const searchParams = useSearchParams()
  const [items, setItems] = useState<ExpenseDto[]>(initialItems)
  const [summary, setSummary] = useState<ExpenseSummary>(initialSummary)
  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<ExpenseTypeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [branchId, setBranchId] = useState(searchParams.get("branchId") ?? "")
  const [expenseTypeId, setExpenseTypeId] = useState(searchParams.get("expenseTypeId") ?? "")
  const [costCenterId, setCostCenterId] = useState(searchParams.get("costCenterId") ?? "")
  const [vendorId] = useState(searchParams.get("vendorId") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "")
  const [sourceModule] = useState(searchParams.get("sourceModule") ?? "")
  const [month, setMonth] = useState(() => {
    const from = searchParams.get("dateFrom") ?? ""
    return /^\d{4}-\d{2}/.test(from) ? from.slice(0, 7) : currentFinanceMonth()
  })
  const { dateFrom, dateTo } = financeMonthRange(month)
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
    if (vendorId) params.set("vendorId", vendorId)
    if (status) params.set("status", status)
    if (sourceModule) params.set("sourceModule", sourceModule)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (search.trim()) params.set("search", search.trim())
    const summaryParams = new URLSearchParams()
    if (branchId) summaryParams.set("branchId", branchId)
    if (dateFrom) summaryParams.set("dateFrom", dateFrom)
    if (dateTo) summaryParams.set("dateTo", dateTo)

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
  }, [branchId, expenseTypeId, costCenterId, vendorId, status, sourceModule, month, search])

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

  return (
    <div className="space-y-4">
      <GlassCard className={cn("relative z-20 flex flex-wrap items-end gap-3 overflow-visible rounded-[1.5rem] shadow-none", surfacePanelClass)}>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">เดือน</span>
          <FinanceMonthPicker month={month} onChange={setMonth} />
        </div>
        <Select
          label="สาขา"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className={cn("min-w-[10rem]", surfaceFieldClass)}
          options={[{ value: "", label: "ทั้งหมด" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
        />
        <Select
          label="ประเภท"
          value={expenseTypeId}
          onChange={(e) => setExpenseTypeId(e.target.value)}
          className={cn("min-w-[10rem]", surfaceFieldClass)}
          options={[{ value: "", label: "ทั้งหมด" }, ...types.map((t) => ({ value: t.id, label: t.name }))]}
        />
        <Select
          label="หน่วยงาน"
          value={costCenterId}
          onChange={(e) => setCostCenterId(e.target.value)}
          className={cn("min-w-[10rem]", surfaceFieldClass)}
          options={[
            { value: "", label: "ทั้งหมด" },
            ...costCenters.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <label className="min-w-[14rem] flex-1 space-y-1.5 text-sm">
          <span className="font-medium text-foreground">ค้นหา</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn("block w-full rounded-lg border py-2 pl-9 pr-3 text-sm", surfaceFieldClass)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="เลขที่ / รายละเอียด / วัตถุต้นทุน"
            />
          </span>
        </label>
      </GlassCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubTabs
          aria-label="สถานะ"
          activeKey={status || "ALL"}
          onChange={(key) => setStatus(key === "ALL" ? "" : key)}
          items={[
            {
              key: "ALL",
              label: "ทั้งหมด",
              count: (Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).reduce((sum, s) => sum + summary.counts[s], 0),
            },
            ...(Object.keys(EXPENSE_STATUS_LABELS) as ExpenseStatus[]).map((s) => ({
              key: s,
              label: EXPENSE_STATUS_LABELS[s],
              count: summary.counts[s],
            })),
          ]}
        />
        {perms.canCreate && (
          <Link
            href="/finance/expenses/new?manual=1"
            className={cn(
              solidBlueButtonClass,
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            )}
          >
            <Plus className="h-4 w-4" />
            บันทึกค่าใช้จ่าย
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.length === 0 && !error ? (
        <GlassCard className={cn("flex flex-col items-center justify-center py-12 text-center", surfacePanelClass)}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700 backdrop-blur-sm dark:bg-emerald-400/15 dark:text-emerald-200">
            <Receipt className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-medium text-foreground">ยังไม่มีรายการค่าใช้จ่าย</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            เริ่มบันทึกค่าใช้จ่าย หรือนำเข้าจากแท็บ &ldquo;ต้นทางโมดูล&rdquo;
          </p>
          {perms.canCreate && (
            <Link
              href="/finance/expenses/new?manual=1"
              className={cn(
                solidBlueButtonClass,
                "mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium"
              )}
            >
              บันทึกค่าใช้จ่าย
            </Link>
          )}
        </GlassCard>
      ) : (
        <AppDataTablePanel>
        <AppDataTable>
          <AppDataTableHead>
            <tr>
              <th className="w-[14%] whitespace-nowrap">เลขที่</th>
              <th className="w-[10%] whitespace-nowrap">วันที่</th>
              <th className="w-[16%]">ประเภท</th>
              <th className="w-[12%] whitespace-nowrap">ต้นทาง</th>
              <th className="w-[16%]">หน่วยงาน</th>
              <th className="w-[14%] whitespace-nowrap text-right">ยอดสุทธิ</th>
              <th className="w-[10%] whitespace-nowrap">สถานะ</th>
            </tr>
          </AppDataTableHead>
          <AppDataTableBody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer"
                onClick={() => router.push(`/finance/expenses/${item.id}`)}
              >
                <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">
                  {item.expenseNo}
                </td>
                <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatDate(item.expenseDate)}
                </td>
                <td className="px-4 py-3">
                  <span className="block truncate" title={item.expenseTypeName}>
                    {item.expenseTypeName}
                    {item.lineCount > 1 && (
                      <span className="ml-1 text-xs text-muted-foreground">+ อีก {item.lineCount - 1}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground" title={item.branchName}>
                    {item.branchName}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {sourceModuleLabel(item.sourceModule)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.costCenterName ?? "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right font-semibold tabular-nums text-foreground">
                  {formatBaht(item.netAmount)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <ExpenseStatusBadge
                    label={EXPENSE_STATUS_LABELS[item.status]}
                    className={EXPENSE_STATUS_BADGE[item.status]}
                  />
                </td>
              </tr>
            ))}
          </AppDataTableBody>
        </AppDataTable>
        </AppDataTablePanel>
      )}
    </div>
  )
}
