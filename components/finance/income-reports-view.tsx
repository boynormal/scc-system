"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { ListFrame } from "@/components/shell/list-frame"
import { DataPanel } from "@/components/shell/data-panel"
import { AppDataTable, AppDataTableBody, AppDataTableHead } from "@/components/shell/app-data-table"
import type { CostCenterRow, Option, ProcessRow } from "./expense-types"
import { formatBaht } from "./finance-theme"
import type { IncomeTypeOption } from "./income-types"

type Bucket = { key: string; label: string; total: number; count: number; percent: number }

type IncomeReportData = {
  grandTotal: number
  count: number
  lineCount: number
  receivedTotal: number
  outstandingTotal: number
  byType: Bucket[]
  byProcess: Bucket[]
  byCostCenter: Bucket[]
  byBranch: Bucket[]
  byMonth: Bucket[]
}

type Filters = {
  dateFrom: string
  dateTo: string
  branchId: string
  incomeTypeId: string
  processId: string
  costCenterId: string
  status: string
}

const REPORT_STATUSES = ["DRAFT", "PENDING", "APPROVED", "RECEIVED"] as const

function bangkokYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(date)
}

function incomesHref(filters: Filters, extra: Partial<Filters> = {}): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...filters, ...extra })) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return qs ? `/finance/incomes?${qs}` : "/finance/incomes"
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

function BucketTable({
  title,
  rows,
  hrefFor,
}: {
  title: string
  rows: Bucket[]
  hrefFor?: (row: Bucket) => string
}) {
  const t = useTranslations("financeIncome")
  return (
    <DataPanel>
      <h3 className="px-4 py-3 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-foreground">{t("reportNoData")}</p>
      ) : (
        <AppDataTable>
          <AppDataTableHead>
            <tr>
              <th>{t("reportItem")}</th>
              <th className="text-right">{t("reportLines")}</th>
              <th className="text-right">{t("reportShare")}</th>
              <th className="text-right">{t("reportTotal")}</th>
            </tr>
          </AppDataTableHead>
          <AppDataTableBody>
            {rows.map((r) => {
              const href = hrefFor?.(r)
              return (
                <tr key={r.key}>
                  <td className="px-4 py-2.5">
                    {href ? (
                      <Link href={href} className="text-emerald-700 hover:underline dark:text-emerald-300">
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.count}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.percent.toFixed(1)}%</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatBaht(r.total)}</td>
                </tr>
              )
            })}
          </AppDataTableBody>
        </AppDataTable>
      )}
    </DataPanel>
  )
}

export function IncomeReportsView({ tabs }: { tabs?: React.ReactNode }) {
  const t = useTranslations("financeIncome")
  const today = bangkokYmd()
  const initial: Filters = {
    dateFrom: `${today.slice(0, 8)}01`,
    dateTo: today,
    branchId: "",
    incomeTypeId: "",
    processId: "",
    costCenterId: "",
    status: "",
  }
  const [draft, setDraft] = useState<Filters>(initial)
  const [applied, setApplied] = useState<Filters>(initial)
  const [data, setData] = useState<IncomeReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<IncomeTypeOption[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const requestId = useRef(0)

  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/incomes/options", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/income-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/processes", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([o, ty, p, c]) => {
        setBranches((o.data?.branches ?? []) as Option[])
        setTypes((ty.data ?? []) as IncomeTypeOption[])
        setProcesses((p.data ?? []) as ProcessRow[])
        setCostCenters((c.data ?? []) as CostCenterRow[])
      })
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    const current = ++requestId.current
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(applied)) if (v) params.set(k, v)
    setLoading(true)
    try {
      const res = await fetch(`/api/finance/reports/incomes?${params}`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (current !== requestId.current) return
      if (!res.ok || !json?.data) {
        setError(t("reportLoadFailed"))
        return
      }
      setError(null)
      setData(json.data as IncomeReportData)
      setTruncated(Boolean(json.meta?.truncated))
    } catch {
      if (current === requestId.current) setError(t("reportLoadFailed"))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [applied, t])

  useEffect(() => {
    void load()
  }, [load])

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function apply() {
    if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
      setError(t("reportDateOrder"))
      return
    }
    setApplied(draft)
  }

  return (
    <ListFrame
      title={t("reportTitle")}
      description={t("reportDescription")}
      actions={tabs}
      plainPanel
      filters={
        <>
          <Input label={t("dateFrom")} type="date" value={draft.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} />
          <Input label={t("dateTo")} type="date" value={draft.dateTo} onChange={(e) => set("dateTo", e.target.value)} />
          <Select
            label={t("branch")}
            value={draft.branchId}
            onChange={(e) => set("branchId", e.target.value)}
            className="min-w-[9rem]"
            options={[{ value: "", label: t("all") }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
          />
          <Select
            label={t("type")}
            value={draft.incomeTypeId}
            onChange={(e) => set("incomeTypeId", e.target.value)}
            className="min-w-[9rem]"
            options={[{ value: "", label: t("all") }, ...types.map((x) => ({ value: x.id, label: x.name }))]}
          />
          <Select
            label={t("process")}
            value={draft.processId}
            onChange={(e) => set("processId", e.target.value)}
            className="min-w-[9rem]"
            options={[
              { value: "", label: t("all") },
              { value: "none", label: t("unspecified") },
              ...processes.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <Select
            label={t("costCenter")}
            value={draft.costCenterId}
            onChange={(e) => set("costCenterId", e.target.value)}
            className="min-w-[9rem]"
            options={[
              { value: "", label: t("all") },
              { value: "none", label: t("unspecified") },
              ...costCenters.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label={t("status")}
            value={draft.status}
            onChange={(e) => set("status", e.target.value)}
            className="min-w-[9rem]"
            options={[
              { value: "", label: t("reportActiveStatuses") },
              ...REPORT_STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
            ]}
          />
          <Button type="button" className="relative z-10 shrink-0 bg-[#059669] hover:bg-[#047857]" loading={loading} onClick={apply}>
            {t("reportApply")}
          </Button>
        </>
      }
    >
      {error ? (
        <DataPanel>
          <ErrorState description={error} onRetry={() => void load()} />
        </DataPanel>
      ) : loading && !data ? (
        <DataPanel>
          <LoadingState />
        </DataPanel>
      ) : !data || data.count === 0 ? (
        <DataPanel>
          <EmptyState icon={BarChart3} title={t("reportNoData")} />
        </DataPanel>
      ) : (
        <div className="space-y-4">
          {truncated && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("reportTruncated")}</p>
          )}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Link href={incomesHref(applied)} className="block">
              <DataPanel padding="sm" className="h-full transition hover:ring-2 hover:ring-emerald-500">
                <p className="text-xs text-foreground">{t("reportGrandTotal")}</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatBaht(data.grandTotal)}</p>
              </DataPanel>
            </Link>
            <DataPanel padding="sm">
              <p className="text-xs text-foreground">{t("reportReceived")}</p>
              <p className="text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatBaht(data.receivedTotal)}</p>
            </DataPanel>
            <DataPanel padding="sm">
              <p className="text-xs text-foreground">{t("reportOutstanding")}</p>
              <p className="text-xl font-bold tabular-nums text-foreground">{formatBaht(data.outstandingTotal)}</p>
            </DataPanel>
            <DataPanel padding="sm">
              <p className="text-xs text-foreground">{t("reportBills")}</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {data.count} <span className="text-sm font-normal">· {t("reportLineCount", { count: data.lineCount })}</span>
              </p>
            </DataPanel>
          </div>
          <div className="grid items-start gap-3 xl:grid-cols-2">
            <BucketTable
              title={t("reportByType")}
              rows={data.byType}
              hrefFor={(r) => incomesHref(applied, { incomeTypeId: r.key })}
            />
            <BucketTable
              title={t("reportByProcess")}
              rows={data.byProcess}
              hrefFor={(r) => incomesHref(applied, { processId: r.key })}
            />
            <BucketTable
              title={t("reportByCostCenter")}
              rows={data.byCostCenter}
              hrefFor={(r) => incomesHref(applied, { costCenterId: r.key })}
            />
            <BucketTable
              title={t("reportByBranch")}
              rows={data.byBranch}
              hrefFor={(r) => incomesHref(applied, { branchId: r.key })}
            />
            <BucketTable
              title={t("reportByMonth")}
              rows={data.byMonth.map((r) => ({ ...r, label: formatMonthLabel(r.key) }))}
            />
          </div>
        </div>
      )}
    </ListFrame>
  )
}
