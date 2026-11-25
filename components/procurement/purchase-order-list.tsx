"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ChevronRight, FilePen, PackageCheck, Paperclip, Plus, Search, ShoppingCart, X } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import {
  AppDataTable,
  AppDataTableBody,
  AppDataTableHead,
  AppDataTablePanel,
} from "@/components/shell/app-data-table"
import { GlassDialog } from "@/components/glass"
import { FolderTabs, folderTabsPanelClass } from "@/components/shell/folder-tabs"
import { ListFrame } from "@/components/shell/list-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import type { PurchaseOrderStatusValue } from "@/modules/procurement/application/po-rules"
import {
  PO_FINANCE_BADGE,
  PO_STATUS_BADGE,
  fmtDate,
  fmtMoney,
  isOverdue,
  type PoOptions,
  type PurchaseOrder,
} from "./po-client"

const STATUS_TABS = ["DRAFT", "ORDERED", "RECEIVED"] as const
type StatusTab = (typeof STATUS_TABS)[number]
const STATUS_ICONS: Record<StatusTab, ReactNode> = {
  DRAFT: <FilePen />,
  ORDERED: <ShoppingCart />,
  RECEIVED: <PackageCheck />,
}

function readStatus(value: string | null): StatusTab {
  if (value === "ORDERED" || value === "RECEIVED" || value === "DRAFT") return value
  return "DRAFT"
}

type ListResponse = { counts: Record<PurchaseOrderStatusValue, number>; data: PurchaseOrder[] }

export function PurchaseOrderList({ canCreate }: { canCreate: boolean }) {
  const t = useTranslations("procurement")
  const tc = useTranslations("common")
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const status = readStatus(params.get("status"))
  const branchId = params.get("branchId") ?? ""
  const supplierId = params.get("supplierId") ?? ""
  const search = params.get("search") ?? ""
  const receivedFrom = params.get("from") ?? ""
  const receivedTo = params.get("to") ?? ""
  const [branchDraft, setBranchDraft] = useState(branchId)
  const [supplierDraft, setSupplierDraft] = useState(supplierId)
  const [searchDraft, setSearchDraft] = useState(search)
  const [fromDraft, setFromDraft] = useState(receivedFrom)
  const [toDraft, setToDraft] = useState(receivedTo)
  const [searchOpen, setSearchOpen] = useState(false)

  const [options, setOptions] = useState<PoOptions | null>(null)
  const [result, setResult] = useState<ListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router]
  )

  const setParam = useCallback((key: string, value: string) => setParams({ [key]: value }), [setParams])

  useEffect(() => {
    if (searchOpen) return
    setBranchDraft(branchId)
    setSupplierDraft(supplierId)
    setSearchDraft(search)
    setFromDraft(receivedFrom)
    setToDraft(receivedTo)
  }, [searchOpen, branchId, supplierId, search, receivedFrom, receivedTo])

  useEffect(() => {
    if (params.get("status") === "") setParam("status", "DRAFT")
  }, [params, setParam])

  useEffect(() => {
    fetchJson<{ data: PoOptions }>("/api/procurement/options")
      .then((res) => setOptions(res.data))
      .catch(() => setOptions(null))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const q = new URLSearchParams()
    if (status) q.set("status", status)
    if (branchId) q.set("branchId", branchId)
    if (supplierId) q.set("supplierId", supplierId)
    if (search) q.set("search", search)
    if (status === "RECEIVED") {
      if (receivedFrom) q.set("from", receivedFrom)
      if (receivedTo) q.set("to", receivedTo)
    }
    try {
      setResult(await fetchJson<ListResponse>(`/api/procurement/purchase-orders?${q.toString()}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [status, branchId, supplierId, search, receivedFrom, receivedTo, t])

  useEffect(() => {
    void load()
  }, [load])

  const counts = result?.counts
  const dateFiltered = status === "RECEIVED" && Boolean(receivedFrom || receivedTo)
  const filtered = Boolean(branchId || supplierId || search || dateFiltered)
  const filterCount = [branchId, supplierId, search, dateFiltered ? "dates" : ""].filter(Boolean).length
  const openQueue = status === "RECEIVED" && !dateFiltered && !branchId && !supplierId && !search
  const rows = result?.data ?? []
  const estimatedSum = Math.round(rows.reduce((sum, po) => sum + po.estimatedTotal, 0) * 100) / 100
  const branchName = options?.branches.find((b) => b.id === branchId)?.name
  const supplierName = options?.suppliers.find((s) => s.id === supplierId)?.name
  const filterTitle = [
    branchName,
    supplierName,
    search,
    dateFiltered ? `${fmtDate(receivedFrom)} – ${fmtDate(receivedTo)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  function clearFilters() {
    setBranchDraft("")
    setSupplierDraft("")
    setSearchDraft("")
    setFromDraft("")
    setToDraft("")
    setParams({ branchId: "", supplierId: "", search: "", from: "", to: "" })
    setSearchOpen(false)
  }

  return (
    <ListFrame plainPanel>
      <div>
      <div className="flex items-end gap-3">
      <FolderTabs
        className="min-w-0 flex-1"
        aria-label={t("colStatus")}
        activeKey={status}
        onChange={(key) => setParam("status", key)}
        items={STATUS_TABS.map((key) => ({
          key,
          label: t(`status_${key}`),
          icon: STATUS_ICONS[key],
          count: counts ? (counts[key] ?? 0) : null,
        }))}
      />
      <span className="mb-0.5 inline-flex shrink-0">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          title={filterTitle || t("searchLabel")}
          className={cn(
            "inline-flex h-11 items-center gap-2 border bg-white px-3 text-base font-semibold text-foreground shadow-sm hover:bg-slate-50 dark:bg-slate-900",
            filterCount > 0
              ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
              : "border-slate-300 dark:border-slate-600",
            filterCount > 0 ? "rounded-l-xl border-r-0" : "rounded-xl"
          )}
        >
          <Search className="h-5 w-5" />
          {t("searchLabel")}
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
      {canCreate ? (
        <Link
          href="/procurement/new"
          className="mb-0.5 inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-base font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          {t("newOrder")}
        </Link>
      ) : null}
      </div>
      <AppDataTablePanel className={folderTabsPanelClass}>
        {dateFiltered ? (
          <p className="border-b border-border px-4 py-2 text-sm text-foreground">
            {t("receivedDateHint", { from: fmtDate(receivedFrom), to: fmtDate(receivedTo) })}
          </p>
        ) : null}
        {loading && !result ? (
          <LoadingState title={tc("loading")} />
        ) : error ? (
          <ErrorState title={t("loadError")} description={error} onRetry={() => void load()} retryLabel={tc("retry")} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={openQueue ? t("receivedOpenEmpty") : filtered ? t("emptyFiltered") : t("emptyTitle")}
            description={canCreate && !filtered && !openQueue ? t("emptyHint") : undefined}
          />
        ) : (
          <div className={cn(loading && "opacity-60 transition-opacity")}>
            <div className="hidden md:block">
              <AppDataTable>
                <AppDataTableHead>
                  <tr>
                    <th className="text-left">{t("colPoNo")}</th>
                    <th className="text-left">{t("colOrderDate")}</th>
                    <th className="text-left">{t("fieldNotes")}</th>
                    <th className="text-right">{t("colTotal")}</th>
                    <th className="text-left">{t("colStatus")}</th>
                    <th className="hidden text-left lg:table-cell">{t("colNeeded")}</th>
                    <th className="text-left">{t("colFinance")}</th>
                  </tr>
                </AppDataTableHead>
                <AppDataTableBody>
                  {rows.map((po) => (
                    <tr
                      key={po.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/procurement/${po.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/procurement/${po.id}`}
                          className="text-base font-semibold text-blue-700 hover:underline dark:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {po.poNo}
                        </Link>
                        <div className="text-sm text-foreground">{po.branchName}</div>
                      </td>
                      <td className="px-4 py-3 text-base text-foreground">{fmtDate(po.orderDate)}</td>
                      <td className="max-w-xs px-4 py-3 text-base text-foreground">
                        <div className="line-clamp-2 break-words">{po.notes?.trim() || "—"}</div>
                        <div className="text-sm text-foreground">
                          {t("itemsCount", { count: po.lines.length })}
                          {po.attachments.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-0.5">
                              <Paperclip className="h-3.5 w-3.5" />
                              {po.attachments.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-foreground">
                        {fmtMoney(po.estimatedTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <PoStatusBadges po={po} />
                      </td>
                      <td className="hidden px-4 py-3 text-base text-foreground lg:table-cell">
                        {fmtDate(po.neededDate)}
                      </td>
                      <td className="px-4 py-3">
                        <FinanceBadge po={po} />
                      </td>
                    </tr>
                  ))}
                </AppDataTableBody>
              </AppDataTable>
            </div>

            <ul className="space-y-2 p-2 md:hidden">
              {rows.map((po) => (
                <li key={po.id}>
                  <Link
                    href={`/procurement/${po.id}`}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-background p-4 active:bg-muted"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-foreground">{po.poNo}</span>
                        <PoStatusBadges po={po} />
                      </div>
                      <div className="line-clamp-2 break-words text-base text-foreground">{po.notes?.trim() || "—"}</div>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm text-foreground">
                        <span>{t("itemsCount", { count: po.lines.length })}</span>
                        {po.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Paperclip className="h-3.5 w-3.5" />
                            {po.attachments.length}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm text-foreground">
                        <span>{fmtDate(po.orderDate)}</span>
                        {po.neededDate && (
                          <span>
                            {t("colNeeded")} {fmtDate(po.neededDate)}
                          </span>
                        )}
                      </div>
                      <FinanceBadge po={po} />
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold tabular-nums text-foreground">
                        {fmtMoney(po.estimatedTotal)}
                      </div>
                      <ChevronRight className="ml-auto mt-1 h-5 w-5 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
              </ul>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-4 py-3 text-base font-semibold text-foreground">
              <span>{filtered ? t("listTotalFiltered", { count: rows.length }) : t("listTotal", { count: rows.length })}</span>
              <span className="shrink-0 tabular-nums">
                {fmtMoney(estimatedSum)} {t("baht")}
              </span>
            </div>
          </div>
        )}
      </AppDataTablePanel>
      <GlassDialog open={searchOpen} onOpenChange={setSearchOpen} title={t("searchLabel")} solid>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setParams({
              branchId: branchDraft,
              supplierId: supplierDraft,
              search: searchDraft.trim(),
              ...(status === "RECEIVED" ? { from: fromDraft, to: toDraft } : {}),
            })
            setSearchOpen(false)
          }}
        >
          <Select
            label={t("filterBranch")}
            value={branchDraft}
            onChange={(e) => setBranchDraft(e.target.value)}
            placeholder={t("allBranches")}
            options={options?.branches.map((b) => ({ value: b.id, label: b.name })) ?? []}
            className="h-12 text-base"
          />
          <Select
            label={t("filterSupplier")}
            value={supplierDraft}
            onChange={(e) => setSupplierDraft(e.target.value)}
            placeholder={t("allSuppliers")}
            options={options?.suppliers.map((s) => ({ value: s.id, label: s.name })) ?? []}
            className="h-12 text-base"
          />
          <Input
            label={t("searchLabel")}
            type="search"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 text-base"
          />
          {status === "RECEIVED" ? (
            <>
              <Input label={t("receivedFrom")} type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)} className="h-12 text-base" />
              <Input label={t("receivedTo")} type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)} className="h-12 text-base" />
            </>
          ) : null}
          <Button type="submit" className="h-12 w-full text-base">
            {t("searchLabel")}
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

export function PoStatusBadges({ po }: { po: Pick<PurchaseOrder, "status" | "neededDate"> }) {
  const t = useTranslations("procurement")
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge variant={PO_STATUS_BADGE[po.status]} className="text-sm">
        {t(`status_${po.status}`)}
      </Badge>
      {isOverdue(po) && (
        <Badge variant="danger" className="text-sm">
          {t("overdue")}
        </Badge>
      )}
    </span>
  )
}

function FinanceBadge({ po }: { po: PurchaseOrder }) {
  const t = useTranslations("procurement")
  if (!po.finance) return <span className="text-sm text-foreground">-</span>
  const finance = po.finance
  return (
    <Badge variant={PO_FINANCE_BADGE[finance.state]} className="text-sm">
      {t(`finance_${finance.state}`)}
      {finance.state === "EXPENSE_CREATED" && finance.expenseNo ? ` · ${finance.expenseNo}` : ""}
    </Badge>
  )
}
