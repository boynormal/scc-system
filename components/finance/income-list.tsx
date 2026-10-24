"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { HandCoins, Plus, Search } from "lucide-react"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { ListFrame } from "@/components/shell/list-frame"
import { SubTabs } from "@/components/shell/sub-tabs"
import { currentFinanceMonth, financeMonthRange, FinanceMonthPicker } from "./finance-month-picker"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { cn, formatDate } from "@/lib/utils"
import type { CostCenterRow, FinancePerms, Option, ProcessRow } from "./expense-types"
import { formatBaht, solidBlueButtonClass } from "./finance-theme"
import {
  INCOME_STATUS_BADGE,
  INCOME_STATUS_LIST,
  type IncomeDto,
  type IncomeSummary,
  type IncomeTypeOption,
} from "./income-types"

export function IncomeList({
  perms,
  initialItems,
  initialSummary,
}: {
  perms: FinancePerms
  initialItems: IncomeDto[]
  initialSummary: IncomeSummary
}) {
  const t = useTranslations("financeIncome")
  const router = useRouter()
  const searchParams = useSearchParams()
  const [items, setItems] = useState<IncomeDto[]>(initialItems)
  const [summary, setSummary] = useState<IncomeSummary>(initialSummary)
  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<IncomeTypeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [processes, setProcesses] = useState<ProcessRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [branchId, setBranchId] = useState(searchParams.get("branchId") ?? "")
  const [incomeTypeId, setIncomeTypeId] = useState(searchParams.get("incomeTypeId") ?? "")
  const [costCenterId, setCostCenterId] = useState(searchParams.get("costCenterId") ?? "")
  const [processId, setProcessId] = useState(searchParams.get("processId") ?? "")
  const [status, setStatus] = useState(searchParams.get("status") ?? "")
  const [month, setMonth] = useState(() => {
    const from = searchParams.get("dateFrom") ?? ""
    return /^\d{4}-\d{2}/.test(from) ? from.slice(0, 7) : currentFinanceMonth()
  })
  const { dateFrom, dateTo } = financeMonthRange(month)
  const [search, setSearch] = useState("")

  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/incomes/options", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/income-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/processes", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([o, ty, c, p]) => {
        setBranches((o.data?.branches ?? []) as Option[])
        setTypes((ty.data ?? []) as IncomeTypeOption[])
        setCostCenters((c.data ?? []) as CostCenterRow[])
        setProcesses((p.data ?? []) as ProcessRow[])
      })
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (branchId) params.set("branchId", branchId)
    if (incomeTypeId) params.set("incomeTypeId", incomeTypeId)
    if (costCenterId) params.set("costCenterId", costCenterId)
    if (processId) params.set("processId", processId)
    if (status) params.set("status", status)
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (search.trim()) params.set("search", search.trim())
    const summaryParams = new URLSearchParams()
    if (branchId) summaryParams.set("branchId", branchId)
    if (dateFrom) summaryParams.set("dateFrom", dateFrom)
    if (dateTo) summaryParams.set("dateTo", dateTo)
    try {
      const [listRes, summaryRes] = await Promise.all([
        fetch(`/api/finance/incomes?${params}`, { cache: "no-store" }),
        fetch(`/api/finance/incomes/summary?${summaryParams}`, { cache: "no-store" }),
      ])
      const json = await listRes.json().catch(() => ({}))
      const summaryJson = await summaryRes.json().catch(() => ({}))
      if (!listRes.ok) {
        setError(t("loadFailed"))
        return
      }
      setError(null)
      setItems((json.data ?? []) as IncomeDto[])
      if (summaryRes.ok && summaryJson.counts) setSummary(summaryJson as IncomeSummary)
    } catch {
      setError(t("loadFailed"))
    }
  }, [branchId, incomeTypeId, costCenterId, processId, status, month, search, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refetch = () => void load()
    window.addEventListener("focus", refetch)
    return () => window.removeEventListener("focus", refetch)
  }, [load])

  const createLink = perms.canCreate ? (
    <Link
      href="/finance/incomes/new"
      className={cn(
        solidBlueButtonClass,
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
      )}
    >
      <Plus className="h-4 w-4" />
      {t("create")}
    </Link>
  ) : undefined

  return (
    <ListFrame
      plainPanel
      filterOverflow
      filters={
        <>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">{t("month")}</span>
            <FinanceMonthPicker month={month} onChange={setMonth} />
          </div>
          <Select
            label={t("branch")}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="min-w-[9rem]"
            options={[{ value: "", label: t("all") }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
          />
          <Select
            label={t("type")}
            value={incomeTypeId}
            onChange={(e) => setIncomeTypeId(e.target.value)}
            className="min-w-[9rem]"
            options={[{ value: "", label: t("all") }, ...types.map((x) => ({ value: x.id, label: x.name }))]}
          />
          <Select
            label={t("costCenter")}
            value={costCenterId}
            onChange={(e) => setCostCenterId(e.target.value)}
            className="min-w-[9rem]"
            options={[
              { value: "", label: t("all") },
              { value: "none", label: t("unspecified") },
              ...costCenters.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label={t("process")}
            value={processId}
            onChange={(e) => setProcessId(e.target.value)}
            className="min-w-[9rem]"
            options={[
              { value: "", label: t("all") },
              { value: "none", label: t("unspecified") },
              ...processes.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <div className="min-w-[12rem] flex-1">
            <Input
              label={t("search")}
              icon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </div>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SubTabs
          aria-label={t("status")}
          activeKey={status || "ALL"}
          onChange={(key) => setStatus(key === "ALL" ? "" : key)}
          items={[
            { key: "ALL", label: t("all"), count: INCOME_STATUS_LIST.reduce((sum, s) => sum + summary.counts[s], 0) },
            ...INCOME_STATUS_LIST.map((s) => ({ key: s, label: t(`statuses.${s}`), count: summary.counts[s] })),
          ]}
        />
        {createLink}
      </div>

      <AppDataTablePanel>
        {error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <EmptyState icon={HandCoins} title={t("empty")} description={t("emptyHint")} action={createLink} />
        ) : (
          <AppDataTable>
            <AppDataTableHead>
              <tr>
                <th className="whitespace-nowrap">{t("incomeNo")}</th>
                <th className="whitespace-nowrap">{t("date")}</th>
                <th>{t("payer")}</th>
                <th>{t("type")}</th>
                <th className="whitespace-nowrap text-right">{t("netAmount")}</th>
                <th className="whitespace-nowrap">{t("status")}</th>
              </tr>
            </AppDataTableHead>
            <AppDataTableBody>
              {items.map((item) => (
                <tr key={item.id} className="cursor-pointer" onClick={() => router.push(`/finance/incomes/${item.id}`)}>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{item.incomeNo}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{formatDate(item.incomeDate)}</td>
                  <td className="px-4 py-2.5">
                    <span className="block truncate">{item.payerName}</span>
                    <span className="block truncate text-xs">{item.branchName}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {item.lines[0]?.incomeTypeName ?? "—"}
                    {item.lineCount > 1 && <span className="ml-1 text-xs">{t("moreLines", { count: item.lineCount - 1 })}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">
                    {formatBaht(item.netAmount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Badge variant={INCOME_STATUS_BADGE[item.status]}>{t(`statuses.${item.status}`)}</Badge>
                  </td>
                </tr>
              ))}
            </AppDataTableBody>
          </AppDataTable>
        )}
      </AppDataTablePanel>
    </ListFrame>
  )
}
