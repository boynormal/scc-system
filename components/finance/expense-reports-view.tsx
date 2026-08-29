"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { FileText, Layers, Receipt, Sigma, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select } from "@/components/ui/select"
import { GlassInput, GlassStatCard } from "@/components/glass"
import {
  GlassCard,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"
import { FinancePageHeader } from "./finance-page-header"
import type { CostCenterRow, ExpenseTypeOption, Option, ProcessRow } from "./expense-types"
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

type MatrixAxis = { key: string; label: string; code?: string | null }

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
  byProcess: Bucket[]
  byCostObject: Bucket[]
  byMonth: Bucket[]
  matrix: {
    processes: MatrixAxis[]
    types: MatrixAxis[]
    cells: Record<string, Record<string, number>>
  }
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
  byProcess: [],
  byCostObject: [],
  byMonth: [],
  matrix: { processes: [], types: [], cells: {} },
}

const REPORT_STATUSES: ExpenseStatus[] = ["DRAFT", "PENDING", "APPROVED", "PAID"]
const MODULE_FILTERS = ["MANUAL", "TRANSPORT", "MAINTENANCE", "INVENTORY", "HR"] as const

function typeOptionLabel(t: ExpenseTypeOption): string {
  return t.code ? `${t.code} · ${t.name}` : t.name
}

function expensesHref(filters: Record<string, string>, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...filters, ...extra })) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `/finance/expenses?${qs}` : "/finance/expenses"
}

function ReportTable({
  title,
  rows,
  hrefFor,
  translateLabel,
}: {
  title: string
  rows: Bucket[]
  hrefFor?: (row: Bucket) => string | null
  translateLabel?: (key: string, label: string) => string
}) {
  return (
    <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
      ) : (
        <GlassTable>
          <GlassTableHeader>
            <tr>
              <GlassTableHead>รายการ</GlassTableHead>
              <GlassTableHead className="whitespace-nowrap text-right">บรรทัด</GlassTableHead>
              <GlassTableHead className="whitespace-nowrap text-right">สัดส่วน</GlassTableHead>
              <GlassTableHead className="whitespace-nowrap text-right">ยอดรวม</GlassTableHead>
            </tr>
          </GlassTableHeader>
          <GlassTableBody>
            {rows.map((r) => {
              const href = hrefFor?.(r)
              const label = translateLabel ? translateLabel(r.key, r.label) : r.label
              return (
                <GlassTableRow key={r.key}>
                  <GlassTableCell className="text-foreground">
                    {href ? (
                      <Link href={href} className="text-emerald-700 hover:underline dark:text-emerald-300">
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {r.count}
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                    {r.percent.toFixed(1)}%
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap text-right font-semibold tabular-nums text-foreground">
                    {formatBaht(r.total)}
                  </GlassTableCell>
                </GlassTableRow>
              )
            })}
          </GlassTableBody>
        </GlassTable>
      )}
    </GlassCard>
  )
}

export function ExpenseReportsView() {
  const [data, setData] = useState<ReportData>(EMPTY)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [branchId, setBranchId] = useState("")
  const [expenseTypeId, setExpenseTypeId] = useState("")
  const [processId, setProcessId] = useState("")
  const [costCenterId, setCostCenterId] = useState("")
  const [sourceModule, setSourceModule] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [status, setStatus] = useState("")

  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<ExpenseTypeOption[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [vendors, setVendors] = useState<Option[]>([])

  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/branches", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/expense-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/processes", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/vendors", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([b, t, p, c, v]) => {
        setBranches((b.data ?? []) as Option[])
        setTypes((t.data ?? []) as ExpenseTypeOption[])
        setProcesses((p.data ?? []) as ProcessRow[])
        setCostCenters((c.data ?? []) as CostCenterRow[])
        setVendors((v.data ?? []) as Option[])
      })
      .catch(() => undefined)
  }, [])

  const listFilters = useMemo(
    () => ({
      branchId,
      expenseTypeId,
      processId,
      costCenterId,
      sourceModule,
      vendorId,
      status,
    }),
    [branchId, expenseTypeId, processId, costCenterId, sourceModule, vendorId, status]
  )

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (branchId) params.set("branchId", branchId)
    if (expenseTypeId) params.set("expenseTypeId", expenseTypeId)
    if (processId) params.set("processId", processId)
    if (costCenterId) params.set("costCenterId", costCenterId)
    if (sourceModule) params.set("sourceModule", sourceModule)
    if (vendorId) params.set("vendorId", vendorId)
    if (status) params.set("status", status)
    const res = await fetch(`/api/finance/reports?${params}`)
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.data) setData(json.data as ReportData)
  }, [dateFrom, dateTo, branchId, expenseTypeId, processId, costCenterId, sourceModule, vendorId, status])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="รายงานค่าใช้จ่าย"
        description="สรุปตามประเภทและกระบวนการ — ไม่รวมรายการยกเลิก/ปฏิเสธ"
      />

      <GlassCard className={cn("flex flex-wrap items-end gap-3 rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
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
          label="ประเภท"
          value={expenseTypeId}
          onChange={(e) => setExpenseTypeId(e.target.value)}
          className={cn("min-w-[12rem]", FIN_GLASS_FIELD)}
          options={[{ value: "", label: "ทั้งหมด" }, ...types.map((t) => ({ value: t.id, label: typeOptionLabel(t) }))]}
        />
        <Select
          label="กระบวนการ"
          value={processId}
          onChange={(e) => setProcessId(e.target.value)}
          className={cn("min-w-[12rem]", FIN_GLASS_FIELD)}
          options={[
            { value: "", label: "ทั้งหมด" },
            { value: "none", label: "ไม่ระบุ Process" },
            ...processes.map((p) => ({ value: p.id, label: p.name })),
          ]}
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
        <Select
          label="สถานะ"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={cn("min-w-[10rem]", FIN_GLASS_FIELD)}
          options={[
            { value: "", label: "ทั้งหมด (ไม่รวมยกเลิก/ปฏิเสธ)" },
            ...REPORT_STATUSES.map((s) => ({ value: s, label: EXPENSE_STATUS_LABELS[s] })),
          ]}
        />
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <GlassStatCard label="ยอดรวม" value={formatBaht(data.grandTotal)} icon={Wallet} className={FIN_GLASS_PANEL} />
        <GlassStatCard label="จำนวนบิล" value={String(data.count)} icon={Receipt} className={FIN_GLASS_PANEL} />
        <GlassStatCard label="จำนวนบรรทัด" value={String(data.lineCount)} icon={Layers} className={FIN_GLASS_PANEL} />
        <GlassStatCard label="เฉลี่ย/บิล" value={formatBaht(data.avgPerBill)} icon={Sigma} className={FIN_GLASS_PANEL} />
        <GlassStatCard label="เฉลี่ย/บรรทัด" value={formatBaht(data.avgPerLine)} icon={FileText} className={FIN_GLASS_PANEL} />
      </div>

      <ReportTable
        title="ค่าใช้จ่ายตามประเภท"
        rows={data.byType}
        hrefFor={(r) => expensesHref(listFilters, { expenseTypeId: r.key })}
      />
      <ReportTable
        title="ค่าใช้จ่ายตามกระบวนการ"
        rows={data.byProcess}
        hrefFor={(r) => expensesHref(listFilters, { processId: r.key })}
      />

      <GlassCard className={cn("rounded-[1.5rem] shadow-none", FIN_GLASS_PANEL)}>
        <h3 className="mb-3 text-sm font-semibold text-foreground">กระบวนการ × ประเภทค่าใช้จ่าย</h3>
        {data.matrix.processes.length === 0 || data.matrix.types.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีข้อมูล</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-max min-w-full text-sm">
              <thead className="border-b border-slate-200/70 text-xs text-muted-foreground dark:border-white/10">
                <tr>
                  <th className="sticky left-0 z-10 bg-white/90 py-2 pr-4 text-left font-medium dark:bg-slate-900/90">
                    กระบวนการ
                  </th>
                  {data.matrix.types.map((t) => (
                    <th key={t.key} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                      {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix.processes.map((p) => (
                  <tr key={p.key} className="border-b border-slate-100/70 dark:border-white/5">
                    <td className="sticky left-0 z-10 bg-white/90 py-2 pr-4 font-medium text-foreground dark:bg-slate-900/90">
                      <Link
                        href={expensesHref(listFilters, { processId: p.key })}
                        className="text-emerald-700 hover:underline dark:text-emerald-300"
                      >
                        {p.label}
                      </Link>
                    </td>
                    {data.matrix.types.map((t) => {
                      const value = data.matrix.cells[p.key]?.[t.key] ?? 0
                      return (
                        <td key={t.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                          {value === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <Link
                              href={expensesHref(listFilters, { processId: p.key, expenseTypeId: t.key })}
                              className="font-medium text-foreground hover:text-emerald-700 hover:underline dark:hover:text-emerald-300"
                            >
                              {formatBaht(value)}
                            </Link>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <ReportTable title="ตามหน่วยงาน" rows={data.byCostCenter} />
        <ReportTable
          title="ตามโมดูลต้นทาง"
          rows={data.byModule}
          translateLabel={(key) => SOURCE_MODULE_LABELS[key] ?? key}
        />
        <ReportTable title="ตามวัตถุต้นทุน" rows={data.byCostObject} />
        <ReportTable title="ตามสาขา" rows={data.byBranch} />
        <ReportTable title="ตามเดือน" rows={data.byMonth} />
      </div>
    </div>
  )
}
