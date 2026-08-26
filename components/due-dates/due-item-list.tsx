"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarDays, Pencil, RefreshCw, Search } from "lucide-react"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn, formatDate } from "@/lib/utils"
import {
  GlassCard,
  GlassTable,
  GlassTableBody,
  GlassTableCell,
  GlassTableHead,
  GlassTableHeader,
  GlassTableRow,
} from "@/components/glass"
import { ALERT_LEVELS, type DueAlertLevel, type DueItemDto } from "./due-item-types"
import { ALERT_VISUAL, DUE_GLASS_FIELD, DUE_GLASS_PANEL, dueTone } from "./due-alert-theme"
import { DueAlertStatCard } from "./due-alert-stat-card"
import { DueDaysChip, DueStatusBadge } from "./due-status-badge"
import { DueRenewDialog } from "./due-renew-dialog"
import { DueOpenToggle } from "./due-open-toggle"
import { DueItemCreateDialog } from "./due-item-create-dialog"

export type DueSummaryCounts = Record<DueAlertLevel, number>

export function DueItemList({
  counts: initialCounts,
  createOpen,
  onCreateOpenChange,
}: {
  counts: DueSummaryCounts
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("dueDates")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [items, setItems] = useState<DueItemDto[]>([])
  const [counts, setCounts] = useState(initialCounts)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [branchId, setBranchId] = useState("")
  const [status, setStatus] = useState("")
  const [alertLevel, setAlertLevel] = useState("")
  const [search, setSearch] = useState("")
  const [renewItem, setRenewItem] = useState<DueItemDto | null>(null)

  useEffect(() => {
    void fetch("/api/due-dates/branches")
      .then((r) => r.json())
      .then((json) => setBranches((json.data ?? []) as { id: string; name: string }[]))
  }, [])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (branchId) params.set("branchId", branchId)
    if (status) params.set("status", status)
    if (alertLevel) params.set("alertLevel", alertLevel)
    if (search.trim()) params.set("search", search.trim())
    const summaryParams = new URLSearchParams()
    if (branchId) summaryParams.set("branchId", branchId)
    const [listRes, summaryRes] = await Promise.all([
      fetch(`/api/due-dates/items?${params}`),
      fetch(`/api/due-dates/summary?${summaryParams}`),
    ])
    const json = await listRes.json().catch(() => ({}))
    const summaryJson = await summaryRes.json().catch(() => ({}))
    if (!listRes.ok) {
      setError(t("loadFailed"))
      setItems([])
      return
    }
    setError(null)
    setItems((json.data ?? []) as DueItemDto[])
    if (summaryRes.ok && summaryJson.counts) setCounts(summaryJson.counts as DueSummaryCounts)
  }, [branchId, status, alertLevel, search, t])

  useEffect(() => {
    void load()
  }, [load])

  function toggleAlert(level: DueAlertLevel) {
    setAlertLevel((current) => (current === level ? "" : level))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {ALERT_LEVELS.map((level) => (
          <button key={level} type="button" onClick={() => toggleAlert(level)} className="text-left">
            <DueAlertStatCard
              level={level}
              label={t(`alert_${level}`)}
              value={String(counts[level])}
              hint={t(`hint_${level}`)}
              selected={alertLevel === level}
            />
          </button>
        ))}
      </div>

      <GlassCard className={cn("flex flex-wrap items-end gap-3 rounded-[1.5rem] shadow-none", DUE_GLASS_PANEL)}>
        <Select
          label={t("branch")}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className={cn("min-w-[10rem]", DUE_GLASS_FIELD)}
          options={[
            { value: "", label: t("filterAll") },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <Select
          label={t("status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={cn("min-w-[10rem]", DUE_GLASS_FIELD)}
          options={[
            { value: "", label: t("filterAll") },
            { value: "open", label: t("st_open") },
            { value: "closed", label: t("st_closed") },
          ]}
        />
        <Select
          label={t("alertLevel")}
          value={alertLevel}
          onChange={(e) => setAlertLevel(e.target.value)}
          className={cn("min-w-[10rem]", DUE_GLASS_FIELD)}
          options={[
            { value: "", label: t("filterAll") },
            ...ALERT_LEVELS.map((level) => ({ value: level, label: t(`alert_${level}`) })),
          ]}
        />
        <label className="min-w-[16rem] flex-1 space-y-1.5 text-sm">
          <span className="font-medium text-foreground">{t("searchLabel")}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(
                "block w-full rounded-lg border py-2 pl-9 pr-3 text-sm",
                DUE_GLASS_FIELD
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </span>
        </label>
      </GlassCard>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.length === 0 && !error ? (
        <GlassCard className={cn("flex flex-col items-center justify-center py-12 text-center", DUE_GLASS_PANEL)}>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-700 backdrop-blur-sm dark:bg-violet-400/15 dark:text-violet-200">
            <CalendarDays className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-medium text-foreground">{t("empty")}</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("emptyHint")}</p>
          <Button type="button" className="mt-4" onClick={() => onCreateOpenChange(true)}>
            {t("newItem")}
          </Button>
        </GlassCard>
      ) : (
        <GlassTable className={cn("rounded-[1.5rem] shadow-none", DUE_GLASS_PANEL)}>
          <GlassTableHeader className="border-slate-200/80 bg-white/70 dark:border-white/10 dark:bg-white/5">
            <tr>
              <GlassTableHead className="w-[16%]">{t("title")}</GlassTableHead>
              <GlassTableHead className="w-[12%] whitespace-nowrap">{t("owner")}</GlassTableHead>
              <GlassTableHead className="w-[32%]">{t("notes")}</GlassTableHead>
              <GlassTableHead className="w-[16%] whitespace-nowrap">{t("dateRange")}</GlassTableHead>
              <GlassTableHead className="w-[8%] whitespace-nowrap">{t("daysRemaining")}</GlassTableHead>
              <GlassTableHead className="w-[10%] whitespace-nowrap">{t("alertLevel")}</GlassTableHead>
              <GlassTableHead className="w-[12%] whitespace-nowrap text-right">{t("actionsTitle")}</GlassTableHead>
            </tr>
          </GlassTableHeader>
          <GlassTableBody>
            {items.map((item) => {
              const tone = dueTone(item.alertLevel, item.status)
              const visual = ALERT_VISUAL[tone]
              return (
                <GlassTableRow
                  key={item.id}
                  className="cursor-pointer bg-white/50 hover:bg-white/80 dark:bg-transparent dark:hover:bg-white/5"
                  onClick={() => router.push(`/due-dates/${item.id}`)}
                >
                  <GlassTableCell className="relative max-w-[16rem] pl-5">
                    <span className={cn("absolute inset-y-0 left-0 w-1", visual.bar)} />
                    <span className="block truncate font-medium text-foreground" title={item.title}>
                      {item.title}
                    </span>
                    <p className="truncate text-xs text-muted-foreground" title={item.branchName}>
                      {item.branchName}
                    </p>
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap">{item.ownerName ?? t("noOwner")}</GlassTableCell>
                  <GlassTableCell className="min-w-[20rem] text-muted-foreground">
                    {item.notes ? (
                      <span className="line-clamp-1 break-all" title={item.notes}>
                        {item.notes}
                      </span>
                    ) : (
                      "—"
                    )}
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {formatDate(item.startDate)} – {formatDate(item.endDate)}
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap">
                    <DueDaysChip days={item.daysRemaining} tone={tone} />
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap">
                    <DueStatusBadge
                      tone={tone}
                      label={item.alertLevel ? t(`alert_${item.alertLevel}`) : t(`st_${item.status}`)}
                    />
                  </GlassTableCell>
                  <GlassTableCell className="whitespace-nowrap text-right">
                    <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/due-dates/${item.id}/edit`)
                        }}
                      >
                        {tCommon("edit")}
                      </Button>
                      {item.status === "open" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenewItem(item)
                          }}
                        >
                          {t("renew")}
                        </Button>
                      )}
                      <DueOpenToggle
                        item={item}
                        onUpdated={() => void load()}
                        onFailed={setError}
                      />
                    </div>
                  </GlassTableCell>
                </GlassTableRow>
              )
            })}
          </GlassTableBody>
        </GlassTable>
      )}
      <DueItemCreateDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        onCreated={() => void load()}
      />
      <DueRenewDialog
        item={renewItem}
        open={renewItem != null}
        onOpenChange={(open) => {
          if (!open) setRenewItem(null)
        }}
        onRenewed={() => void load()}
      />
    </div>
  )
}
