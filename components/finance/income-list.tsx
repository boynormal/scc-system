"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { BadgeCheck, FilePen, HandCoins, Plus, Search, Wallet, X } from "lucide-react"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassDialog } from "@/components/glass"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { ListFrame } from "@/components/shell/list-frame"
import { FolderTabs, folderTabsPanelClass } from "@/components/shell/folder-tabs"
import { AppDataTable, AppDataTableBody, AppDataTableHead, AppDataTablePanel } from "@/components/shell/app-data-table"
import { cn, formatDate } from "@/lib/utils"
import type { CostCenterRow, FinancePerms, Option } from "./expense-types"
import { formatBaht, solidBlueButtonClass } from "./finance-theme"
import {
  INCOME_STATUS_BADGE,
  type IncomeDto,
  type IncomeStatus,
  type IncomeSummary,
  type IncomeTypeOption,
} from "./income-types"

const INCOME_TABS = ["DRAFT", "APPROVED", "RECEIVED"] as const
type IncomeTab = (typeof INCOME_TABS)[number]
/** Draft queue: unfinished bills, bills waiting for approval, and bills sent back to fix. */
const DRAFT_TAB_STATUSES = "DRAFT,PENDING,REJECTED"

const TAB_ICONS: Record<IncomeTab, ReactNode> = {
  DRAFT: <FilePen />,
  APPROVED: <BadgeCheck />,
  RECEIVED: <Wallet />,
}

function readTab(value: string | null): IncomeTab {
  if (value === "APPROVED" || value === "RECEIVED") return value
  return "DRAFT"
}

function statusesForTab(tab: IncomeTab): string {
  return tab === "DRAFT" ? DRAFT_TAB_STATUSES : tab
}

function inTab(status: IncomeStatus, tab: IncomeTab): boolean {
  return statusesForTab(tab).split(",").includes(status)
}

const RECEIVED_LOOKBACK_DAYS = 15

function bangkokYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
}

/** Last 15 Bangkok days through today. The received tab uses this until a date search is set. */
function receivedDefaultRange(now = new Date()) {
  const to = bangkokYmd(now)
  const anchor = new Date(`${to}T12:00:00+07:00`)
  const from = bangkokYmd(new Date(anchor.getTime() - RECEIVED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000))
  return { from, to }
}

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
  const [items, setItems] = useState<IncomeDto[]>(() => {
    const tab = readTab(searchParams.get("status"))
    return initialItems.filter((item) => inTab(item.status, tab))
  })
  const [summary, setSummary] = useState<IncomeSummary>(initialSummary)
  const [branches, setBranches] = useState<Option[]>([])
  const [types, setTypes] = useState<IncomeTypeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [branchId, setBranchId] = useState(searchParams.get("branchId") ?? "")
  const [incomeTypeId, setIncomeTypeId] = useState(searchParams.get("incomeTypeId") ?? "")
  const [costCenterId, setCostCenterId] = useState(searchParams.get("costCenterId") ?? "")
  const [status, setStatus] = useState(() => readTab(searchParams.get("status")))
  const [receivedFrom, setReceivedFrom] = useState("")
  const [receivedTo, setReceivedTo] = useState("")
  const [search, setSearch] = useState("")
  const [branchDraft, setBranchDraft] = useState(searchParams.get("branchId") ?? "")
  const [typeDraft, setTypeDraft] = useState(searchParams.get("incomeTypeId") ?? "")
  const [centerDraft, setCenterDraft] = useState(searchParams.get("costCenterId") ?? "")
  const [searchDraft, setSearchDraft] = useState("")
  const [fromDraft, setFromDraft] = useState("")
  const [toDraft, setToDraft] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (searchOpen) return
    setBranchDraft(branchId)
    setTypeDraft(incomeTypeId)
    setCenterDraft(costCenterId)
    setSearchDraft(search)
    setFromDraft(receivedFrom)
    setToDraft(receivedTo)
  }, [searchOpen, branchId, incomeTypeId, costCenterId, search, receivedFrom, receivedTo])

  useEffect(() => {
    void Promise.all([
      fetch("/api/finance/incomes/options", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/income-types", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/finance/cost-centers", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([o, ty, c]) => {
        setBranches((o.data?.branches ?? []) as Option[])
        setTypes((ty.data ?? []) as IncomeTypeOption[])
        setCostCenters((c.data ?? []) as CostCenterRow[])
      })
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (branchId) params.set("branchId", branchId)
    if (incomeTypeId) params.set("incomeTypeId", incomeTypeId)
    if (costCenterId) params.set("costCenterId", costCenterId)
    params.set("status", statusesForTab(status))
    const window = receivedDefaultRange()
    const activeFrom = status === "RECEIVED" ? receivedFrom || window.from : ""
    const activeTo = status === "RECEIVED" ? receivedTo || window.to : ""
    if (status === "RECEIVED") {
      params.set("dateFrom", activeFrom)
      params.set("dateTo", activeTo)
    }
    if (search.trim()) params.set("search", search.trim())
    const summaryParams = new URLSearchParams()
    if (branchId) summaryParams.set("branchId", branchId)
    summaryParams.set("receivedFrom", receivedFrom || window.from)
    summaryParams.set("receivedTo", receivedTo || window.to)
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
  }, [branchId, incomeTypeId, costCenterId, status, receivedFrom, receivedTo, search, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refetch = () => void load()
    window.addEventListener("focus", refetch)
    return () => window.removeEventListener("focus", refetch)
  }, [load])

  const dateFiltered = Boolean(receivedFrom || receivedTo)
  const filterCount = [branchId, incomeTypeId, costCenterId, search.trim(), dateFiltered ? "dates" : ""].filter(Boolean).length
  const netSum = Math.round(items.reduce((sum, item) => sum + item.netAmount, 0) * 100) / 100
  const filterTitle = [
    branches.find((b) => b.id === branchId)?.name,
    types.find((x) => x.id === incomeTypeId)?.name,
    costCenterId === "none" ? t("unspecified") : costCenters.find((c) => c.id === costCenterId)?.name,
    search.trim(),
    dateFiltered ? `${formatDate(receivedFrom)} – ${formatDate(receivedTo)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  function clearFilters() {
    setBranchId("")
    setIncomeTypeId("")
    setCostCenterId("")
    setSearch("")
    setBranchDraft("")
    setTypeDraft("")
    setCenterDraft("")
    setSearchDraft("")
    setReceivedFrom("")
    setReceivedTo("")
    setFromDraft("")
    setToDraft("")
    setSearchOpen(false)
  }

  const createLink = perms.canCreate ? (
    <Link
      href="/finance/incomes/new"
      className={cn(
        solidBlueButtonClass,
        "mb-0.5 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold shadow-sm"
      )}
    >
      <Plus className="h-4 w-4" />
      {t("create")}
    </Link>
  ) : undefined

  return (
    <ListFrame plainPanel>
      <div>
      <div className="flex items-end gap-3">
        <FolderTabs
          className="min-w-0 flex-1"
          aria-label={t("status")}
          activeKey={status}
          onChange={(key) => setStatus(readTab(key))}
          items={INCOME_TABS.map((tab) => ({
            key: tab,
            label: t(`statuses.${tab}`),
            icon: TAB_ICONS[tab],
            count:
              tab === "DRAFT"
                ? summary.counts.DRAFT + summary.counts.PENDING + summary.counts.REJECTED
                : summary.counts[tab],
          }))}
        />
        <span className="mb-0.5 inline-flex shrink-0">
          <button
            type="button"
            onClick={() => {
              if (status === "RECEIVED" && !fromDraft && !toDraft) {
                const range = receivedDefaultRange()
                setFromDraft(range.from)
                setToDraft(range.to)
              }
              setSearchOpen(true)
            }}
            title={filterTitle || t("search")}
            className={cn(
              "inline-flex h-11 items-center gap-2 border bg-white px-3 text-base font-semibold text-foreground shadow-sm hover:bg-slate-50 dark:bg-slate-900",
              filterCount > 0
                ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                : "border-slate-300 dark:border-slate-600",
              filterCount > 0 ? "rounded-l-xl border-r-0" : "rounded-xl"
            )}
          >
            <Search className="h-5 w-5" />
            {t("search")}
            {filterCount > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-sm text-white">
                {filterCount}
              </span>
            ) : null}
          </button>
          {filterCount > 0 ? (
            <button
              type="button"
              aria-label={t("clearFilters")}
              title={t("clearFilters")}
              onClick={clearFilters}
              className="inline-flex h-11 w-11 items-center justify-center rounded-r-xl border border-blue-600 bg-blue-50 text-foreground shadow-sm hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-950/40"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </span>
        {createLink}
      </div>

      <AppDataTablePanel className={folderTabsPanelClass}>
        {error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <EmptyState icon={HandCoins} title={t("empty")} description={t("emptyHint")} action={createLink} />
        ) : (
          <>
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
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-4 py-3 text-base font-semibold text-foreground">
            <span>{filterCount > 0 ? t("listTotalFiltered", { count: items.length }) : t("listTotal", { count: items.length })}</span>
            <span className="shrink-0 tabular-nums">{formatBaht(netSum)}</span>
          </div>
          </>
        )}
      </AppDataTablePanel>
      <GlassDialog open={searchOpen} onOpenChange={setSearchOpen} title={t("search")} solid>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setBranchId(branchDraft)
            setIncomeTypeId(typeDraft)
            setCostCenterId(centerDraft)
            setSearch(searchDraft.trim())
            if (status === "RECEIVED") {
              const range = receivedDefaultRange()
              const sameAsDefault = fromDraft === range.from && toDraft === range.to
              setReceivedFrom(fromDraft && toDraft && !sameAsDefault ? fromDraft : "")
              setReceivedTo(fromDraft && toDraft && !sameAsDefault ? toDraft : "")
            }
            setSearchOpen(false)
          }}
        >
          <Select
            label={t("branch")}
            value={branchDraft}
            onChange={(e) => setBranchDraft(e.target.value)}
            placeholder={t("all")}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            className="h-12 text-base"
          />
          <Select
            label={t("type")}
            value={typeDraft}
            onChange={(e) => setTypeDraft(e.target.value)}
            placeholder={t("all")}
            options={types.map((x) => ({ value: x.id, label: x.name }))}
            className="h-12 text-base"
          />
          <Select
            label={t("costCenter")}
            value={centerDraft}
            onChange={(e) => setCenterDraft(e.target.value)}
            placeholder={t("all")}
            options={[
              { value: "none", label: t("unspecified") },
              ...costCenters.map((c) => ({ value: c.id, label: c.name })),
            ]}
            className="h-12 text-base"
          />
          <Input
            label={t("search")}
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 text-base"
          />
          {status === "RECEIVED" ? (
            <>
              <Input label={t("dateFrom")} type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)} className="h-12 text-base" />
              <Input label={t("dateTo")} type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)} className="h-12 text-base" />
            </>
          ) : null}
          <Button type="submit" className="h-12 w-full text-base">
            {t("search")}
          </Button>
          {filterCount > 0 ? (
            <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          ) : null}
        </form>
      </GlassDialog>
      </div>
    </ListFrame>
  )
}
