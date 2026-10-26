"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Layers,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  Wallet,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { GlassInput } from "@/components/glass"
import { GlassCard } from "@/components/glass"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { FinancePageHeader } from "./finance-page-header"
import type { CostCenterRow, ExpenseTypeOption, Option } from "./expense-types"
import {
  EXPENSE_STATUS_LABELS,
  FIN_GLASS_FIELD,
  FIN_GLASS_PANEL,
  SOURCE_MODULE_LABELS,
  formatBaht,
  type ExpenseStatus,
} from "./finance-theme"

type Bucket = {
  key: string
  label: string
  total: number
  count: number
  percent: number
  code?: string | null
}

type ReportFilters = {
  dateFrom: string
  dateTo: string
  branchId: string
  expenseTypeId: string
  costCenterId: string
  sourceModule: string
  vendorId: string
  status: string
}

type ReportData = {
  grandTotal: number
  count: number
  lineCount: number
  avgPerBill: number
  avgPerLine: number
  byModule: Bucket[]
  byBranch: Bucket[]
  byCostCenter: Bucket[]
  byType: Bucket[]
  byCostObject: Bucket[]
  byMonth: Bucket[]
}

const EMPTY: ReportData = {
  grandTotal: 0,
  count: 0,
  lineCount: 0,
  avgPerBill: 0,
  avgPerLine: 0,
  byModule: [],
  byBranch: [],
  byCostCenter: [],
  byType: [],
  byCostObject: [],
  byMonth: [],
}

const REPORT_STATUSES: ExpenseStatus[] = ["DRAFT", "PENDING", "APPROVED", "PAID"]
const MODULE_FILTERS = ["MANUAL", "TRANSPORT", "MAINTENANCE", "INVENTORY", "HR"] as const
const TABLE_PREVIEW = 8

function bangkokYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date)
}

function bangkokMonthStart(date = new Date()): string {
  return `${bangkokYmd(date).slice(0, 8)}01`
}

function bangkokYearStart(date = new Date()): string {
  return `${bangkokYmd(date).slice(0, 4)}-01-01`
}

function addMonthsYmd(ymd: string, delta: number): string {
  const [year, month] = ymd.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`
}

function typeOptionLabel(t: ExpenseTypeOption): string {
  return t.code ? `${t.code} · ${t.name}` : t.name
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  if (!year || !month) return key
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("th-TH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function expensesHref(filters: Record<string, string>, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...filters, ...extra })) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `/finance/expenses?${qs}` : "/finance/expenses"
}

function csvEscape(value: string | number): string {
  const text = String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ShareBar({ rows }: { rows: Bucket[] }) {
  const max = Math.max(...rows.map((r) => r.total), 0)
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-foreground" title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {row.percent.toFixed(1)}% · {formatBaht(row.total)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${max > 0 ? Math.max((row.total / max) * 100, 2) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function MonthlyChart({ rows }: { rows: Bucket[] }) {
  const visible = rows.slice(-12)
  const max = Math.max(...visible.map((row) => row.total), 0)
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
  }
  return (
    <div className="flex h-56 items-end gap-2 border-b border-slate-200/80 px-1 pt-7 dark:border-white/10">
      {visible.map((row) => {
        const height = max > 0 ? Math.max((row.total / max) * 100, 4) : 4
        return (
          <div key={row.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div className="relative flex w-full flex-1 items-end justify-center">
              <span className="pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg group-hover:block">
                {formatBaht(row.total)}
              </span>
              <div
                className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all group-hover:from-emerald-700 group-hover:to-emerald-500"
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="max-w-full truncate text-[10px] text-muted-foreground">
              {formatMonthLabel(row.key)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ReportTable({
  title,
  rows,
  hrefFor,
  translateLabel,
  preview = TABLE_PREVIEW,
}: {
  title: string
  rows: Bucket[]
  hrefFor?: (row: Bucket) => string | null
  translateLabel?: (key: string, label: string) => string
  preview?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? rows : rows.slice(0, preview)
  const hidden = rows.length - visible.length
  return (
    <AppDataTablePanel className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground dark:bg-white/10">
          {rows.length} รายการ
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
      ) : (
        <div className="rounded-lg border border-border">
        <AppDataTable>
          <AppDataTableHead>
            <tr>
              <th>รายการ</th>
              <th className="whitespace-nowrap text-right">บรรทัด</th>
              <th className="whitespace-nowrap text-right">สัดส่วน</th>
              <th className="whitespace-nowrap text-right">ยอดรวม</th>
            </tr>
          </AppDataTableHead>
          <AppDataTableBody>
            {visible.map((r) => {
              const href = hrefFor?.(r)
              const label = translateLabel ? translateLabel(r.key, r.label) : r.label
              return (
                <tr key={r.key}>
                  <td className="px-4 py-3">
                    {href ? (
                      <Link
                        href={href}
                        title={label}
                        className="block max-w-[20rem] truncate text-emerald-700 hover:underline dark:text-emerald-300"
                      >
                        {label}
                      </Link>
                    ) : (
                      <span className="block max-w-[20rem] truncate" title={label}>
                        {label}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {r.count}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {r.percent.toFixed(1)}%
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                    {formatBaht(r.total)}
                  </td>
                </tr>
              )
            })}
          </AppDataTableBody>
        </AppDataTable>
        </div>
      )}
      {rows.length > preview && (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-slate-200/80 py-2 text-xs font-medium text-muted-foreground hover:bg-slate-50 hover:text-foreground dark:border-white/10 dark:hover:bg-white/5"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "ย่อรายการ" : `ดูทั้งหมดอีก ${hidden} รายการ`}
        </button>
      )}
    </AppDataTablePanel>
  )
}

export function ExpenseReportsView() {
  const today = bangkokYmd()
  const initialFilters: ReportFilters = {
    dateFrom: bangkokMonthStart(),
    dateTo: today,
    branchId: "",
    expenseTypeId: "",
    costCenterId: "",
    sourceModule: "",
    vendorId: "",
    status: "",
  }
  const [data, setData] = useState<ReportData>(EMPTY)
  const [dateFrom, setDateFrom] = useState(initialFilters.dateFrom)
  const [dateTo, setDateTo] = useState(today)
  const [branchId, setBranchId] = useState("")
  const [expenseTypeId, setExpenseTypeId] = useState("")
  const [costCenterId, setCostCenterId] = useState("")
  const [sourceModule, setSourceModule] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(initialFilters)
  const requestId = useRef(0)

  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<ExpenseTypeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [vendors, setVendors] = useState<Option[]>([])

  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/branches", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/expense-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/vendors", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, t, c, v]) => {
        setBranches((b.data ?? []) as Option[])
        setTypes((t.data ?? []) as ExpenseTypeOption[])
        setCostCenters((c.data ?? []) as CostCenterRow[])
        setVendors((v.data ?? []) as Option[])
      })
      .catch(() => undefined)
  }, [])

  const listFilters = useMemo(() => appliedFilters, [appliedFilters])

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(appliedFilters)) {
      if (value) params.set(key, value)
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/reports?${params}`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (currentRequest !== requestId.current) return
      if (!res.ok || !json?.data) {
        setError("โหลดรายงานไม่สำเร็จ")
        return
      }
      setError(null)
      setData(json.data as ReportData)
      setTruncated(Boolean(json.meta?.truncated))
      setLoadedAt(new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }))
    } catch {
      if (currentRequest === requestId.current) setError("โหลดรายงานไม่สำเร็จ")
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [appliedFilters])

  useEffect(() => {
    void load()
  }, [load])

  const hasExtraFilters = Boolean(
    branchId || expenseTypeId || costCenterId || sourceModule || vendorId || status
  )
  const isCurrentMonth = dateFrom === bangkokMonthStart() && dateTo === today
  const isTwoMonths = dateFrom === addMonthsYmd(bangkokMonthStart(), -1) && dateTo === today
  const isThisYear = dateFrom === bangkokYearStart() && dateTo === today
  const isAllTime = !dateFrom && !dateTo

  function applyPreset(from: string, to: string) {
    setDateFrom(from)
    setDateTo(to)
    setAppliedFilters((current) => ({ ...current, dateFrom: from, dateTo: to }))
  }

  function clearFilters() {
    const reset = { ...initialFilters, dateFrom: bangkokMonthStart(), dateTo: bangkokYmd() }
    setDateFrom(reset.dateFrom)
    setDateTo(reset.dateTo)
    setBranchId("")
    setExpenseTypeId("")
    setCostCenterId("")
    setSourceModule("")
    setVendorId("")
    setStatus("")
    setAppliedFilters(reset)
  }

  function applyFilters() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด")
      return
    }
    setAppliedFilters({
      dateFrom,
      dateTo,
      branchId,
      expenseTypeId,
      costCenterId,
      sourceModule,
      vendorId,
      status,
    })
  }

  function exportCsv() {
    const sections: Array<[string, Bucket[]]> = [
      ["ตามประเภท", data.byType],
      ["ตามหน่วยงาน", data.byCostCenter],
      ["ตามโมดูลต้นทาง", data.byModule],
      ["ตามวัตถุต้นทุน", data.byCostObject],
      ["ตามสาขา", data.byBranch],
      ["ตามเดือน", data.byMonth],
    ]
    const lines = [
      csvEscape("รายงานค่าใช้จ่าย"),
      `ช่วง,${csvEscape(appliedFilters.dateFrom || "ทั้งหมด")},${csvEscape(appliedFilters.dateTo || "ทั้งหมด")}`,
      `ยอดรวม,${data.grandTotal}`,
      `จำนวนบิล,${data.count}`,
      `จำนวนบรรทัด,${data.lineCount}`,
      "",
    ]
    for (const [title, rows] of sections) {
      lines.push(title)
      lines.push(["รายการ", "บรรทัด", "สัดส่วน", "ยอดรวม"].map(csvEscape).join(","))
      for (const row of rows) {
        const label =
          title === "ตามเดือน"
            ? formatMonthLabel(row.key)
            : title === "ตามโมดูลต้นทาง"
              ? (SOURCE_MODULE_LABELS[row.key] ?? row.label)
              : row.label
        lines.push([label, row.count, `${row.percent}%`, row.total].map(csvEscape).join(","))
      }
      lines.push("")
    }
    downloadCsv(
      `expense-report-${appliedFilters.dateFrom || "all"}-${appliedFilters.dateTo || "all"}.csv`,
      lines
    )
  }

  const billsHref = expensesHref(listFilters)
  const presetClass = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium",
      active
        ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
        : "border-slate-300 bg-white/80 text-muted-foreground hover:text-foreground dark:border-white/15 dark:bg-transparent"
    )

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="รายงานค่าใช้จ่าย"
        description="สรุปยอดสุทธิตามประเภทและหน่วยงาน — ไม่รวมรายการยกเลิก/ปฏิเสธ"
        actions={
          <>
            <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv} disabled={loading}>
              ส่งออก CSV
            </Button>
            <Link
              href={billsHref}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted dark:border-white/15 dark:bg-transparent"
            >
              เปิดรายการบิล
            </Link>
          </>
        }
      />

      <GlassCard className={cn("space-y-3 rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="mr-1 h-4 w-4 text-muted-foreground" />
          <button type="button" className={presetClass(isCurrentMonth)} onClick={() => applyPreset(bangkokMonthStart(), today)}>
            เดือนนี้
          </button>
          <button
            type="button"
            className={presetClass(isTwoMonths)}
            onClick={() => applyPreset(addMonthsYmd(bangkokMonthStart(), -1), today)}
          >
            2 เดือนล่าสุด
          </button>
          <button type="button" className={presetClass(isThisYear)} onClick={() => applyPreset(bangkokYearStart(), today)}>
            ปีนี้
          </button>
          <button type="button" className={presetClass(isAllTime)} onClick={() => applyPreset("", "")}>
            ทั้งหมด
          </button>
          </div>
          {(hasExtraFilters || !isCurrentMonth) && (
            <Button type="button" variant="ghost" size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={clearFilters}>
              ล้างตัวกรอง
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <GlassInput
            label="ตั้งแต่วันที่"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={FIN_GLASS_FIELD}
          />
          <GlassInput
            label="ถึงวันที่"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={FIN_GLASS_FIELD}
          />
          <Select
            label="สาขา"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
            options={[{ value: "", label: "ทั้งหมด" }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
          />
          <Select
            label="สถานะ"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn("min-w-[11rem]", FIN_GLASS_FIELD)}
            options={[
              { value: "", label: "สถานะที่ใช้งาน" },
              ...REPORT_STATUSES.map((s) => ({ value: s, label: EXPENSE_STATUS_LABELS[s] })),
            ]}
          />
          <Button type="button" onClick={applyFilters} loading={loading} className="relative z-10 bg-[#059669] hover:bg-[#047857]">
            แสดงรายงาน
          </Button>
          <Button
            type="button"
            variant="ghost"
            icon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setAdvancedOpen((current) => !current)}
          >
            ตัวกรองเพิ่มเติม
            <ChevronDown className={cn("ml-1 h-4 w-4 transition", advancedOpen && "rotate-180")} />
          </Button>
        </div>
        {advancedOpen && (
          <div className="grid gap-3 border-t border-slate-200/80 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10">
          <Select
            label="ประเภท"
            value={expenseTypeId}
            onChange={(e) => setExpenseTypeId(e.target.value)}
            className={cn("min-w-[12rem]", FIN_GLASS_FIELD)}
            options={[{ value: "", label: "ทั้งหมด" }, ...types.map((t) => ({ value: t.id, label: typeOptionLabel(t) }))]}
          />
          <Select
            label="หน่วยงาน"
            value={costCenterId}
            onChange={(e) => setCostCenterId(e.target.value)}
            className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
            options={[{ value: "", label: "ทั้งหมด" }, ...costCenters.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Select
            label="ต้นทาง"
            value={sourceModule}
            onChange={(e) => setSourceModule(e.target.value)}
            className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
            options={[
              { value: "", label: "ทั้งหมด" },
              ...MODULE_FILTERS.map((m) => ({ value: m, label: SOURCE_MODULE_LABELS[m] ?? m })),
            ]}
          />
          <Select
            label="ผู้ขาย"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className={cn("min-w-[12rem]", FIN_GLASS_FIELD)}
            options={[{ value: "", label: "ทั้งหมด" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
          />
          </div>
        )}
      </GlassCard>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {truncated && !error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          ช่วงที่เลือกมีมากกว่า 10,000 บิล รายงานนี้สรุปจาก 10,000 บิลแรก กรุณาจำกัดช่วงวันที่หรือสาขาเพื่อให้ยอดครบถ้วน
        </div>
      )}

      <GlassCard
        padding="none"
        className={cn(
          "grid rounded-[1.5rem] shadow-none lg:grid-cols-[1.35fr_2fr]",
          FIN_GLASS_PANEL
        )}
      >
        <Link
          href={billsHref}
          className="group relative overflow-hidden border-b border-slate-200/80 p-6 lg:border-b-0 lg:border-r dark:border-white/10"
        >
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
                <Wallet className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
            <p className="mt-5 text-sm font-medium text-muted-foreground">ยอดสุทธิในช่วงที่เลือก</p>
            <p className="mt-1 break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {loading ? "…" : formatBaht(data.grandTotal)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">กดเพื่อเปิดรายการบิลที่รวมอยู่ในยอดนี้</p>
          </div>
        </Link>
        <div className="grid grid-cols-2">
          {[
            { label: "จำนวนบิล", value: String(data.count), icon: Receipt },
            { label: "จำนวนบรรทัด", value: String(data.lineCount), icon: Layers },
            { label: "เฉลี่ยต่อบิล", value: formatBaht(data.avgPerBill), icon: FileText },
            { label: "เฉลี่ยต่อบรรทัด", value: formatBaht(data.avgPerLine), icon: FileText },
          ].map((item, index) => (
            <div
              key={item.label}
              className={cn(
                "min-w-0 p-5",
                index % 2 === 0 && "border-r border-slate-200/80 dark:border-white/10",
                index < 2 && "border-b border-slate-200/80 dark:border-white/10"
              )}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              <p className="mt-2 truncate text-xl font-bold tabular-nums text-foreground" title={item.value}>
                {loading ? "…" : item.value}
              </p>
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">ประเภทที่ใช้จ่ายสูงสุด</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">6 อันดับแรกจากยอดสุทธิ</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Top 6
            </span>
          </div>
          {data.byType.length === 0 ? (
            <p className="text-sm text-muted-foreground">ไม่มีข้อมูลในช่วงนี้</p>
          ) : (
            <ShareBar rows={data.byType.slice(0, 6)} />
          )}
        </GlassCard>
        <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
          <div className="mb-1 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">แนวโน้มค่าใช้จ่าย</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">สูงสุด 12 เดือนล่าสุดในช่วงที่เลือก</p>
            </div>
          </div>
          <MonthlyChart rows={data.byMonth} />
        </GlassCard>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          <h2 className="text-lg font-bold text-foreground">รายละเอียดเชิงวิเคราะห์</h2>
          <p className="text-sm text-muted-foreground">กดรายการเพื่อเจาะไปยังบิลต้นทาง</p>
        </div>
      </div>

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <ReportTable
          title="ค่าใช้จ่ายตามประเภท"
          rows={data.byType}
          hrefFor={(r) => expensesHref(listFilters, { expenseTypeId: r.key })}
          preview={10}
        />
        <ReportTable
          title="ตามหน่วยงาน"
          rows={data.byCostCenter}
          hrefFor={(r) =>
            r.key === "none" ? null : expensesHref(listFilters, { costCenterId: r.key })
          }
        />
        <ReportTable
          title="ตามโมดูลต้นทาง"
          rows={data.byModule}
          translateLabel={(key) => SOURCE_MODULE_LABELS[key] ?? key}
          hrefFor={(r) => expensesHref(listFilters, { sourceModule: r.key })}
        />
        <ReportTable title="ตามวัตถุต้นทุน" rows={data.byCostObject} />
        <ReportTable
          title="ตามสาขา"
          rows={data.byBranch}
          hrefFor={(r) => expensesHref(listFilters, { branchId: r.key })}
        />
        <ReportTable
          title="ตามเดือน"
          rows={data.byMonth.map((row) => ({ ...row, label: formatMonthLabel(row.key) }))}
        />
      </div>

      {loadedAt && (
        <p className="text-xs text-muted-foreground">อัปเดตล่าสุด {loadedAt}</p>
      )}
    </div>
  )
}
