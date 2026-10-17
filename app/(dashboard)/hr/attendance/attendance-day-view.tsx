"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { ChevronDown, ChevronRight, Clock } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { GlassCard } from "@/components/glass"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { LoadingState } from "@/components/ui/loading-state"
import { formatDateTime, formatMinutes, formatTime, todayInZone } from "./attendance-format"

type DayRow = {
  id: string
  personnelId: string
  rosterNo: string
  displayName: string
  jobGroup: string | null
  badgeNumbers: string[]
  firstIn: string
  lastOut: string | null
  punchCount: number
  workedMinutes: number
  status: "COMPLETE" | "SINGLE_PUNCH"
}

type DayData = {
  branch: { id: string; timezone: string }
  date: string
  lastSyncedAt: string | null
  unmappedBadgesToday: number
  rows: DayRow[]
}

type Punch = { id: string; punchAt: string; badgeNumber: string; deviceName: string; counted: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function AttendanceDayView({ branchId, initialDate }: { branchId: string; initialDate?: string }) {
  const t = useTranslations("attendance")
  const locale = useLocale()
  const [date, setDate] = useState(() => (initialDate && DATE_RE.test(initialDate) ? initialDate : todayInZone("Asia/Bangkok")))
  const [data, setData] = useState<DayData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [punches, setPunches] = useState<Record<string, Punch[] | "loading" | "error">>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setOpenId(null)
    try {
      const res = await fetchJson<{ data: DayData }>(
        `/api/hr/attendance/days?${new URLSearchParams({ branchId, date })}`
      )
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [branchId, date])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(row: DayRow) {
    if (openId === row.id) {
      setOpenId(null)
      return
    }
    setOpenId(row.id)
    if (Array.isArray(punches[row.id])) return
    setPunches((p) => ({ ...p, [row.id]: "loading" }))
    try {
      const res = await fetchJson<{ data: Punch[] }>(
        `/api/hr/attendance/days/punches?${new URLSearchParams({ branchId, personnelId: row.personnelId, date })}`
      )
      setPunches((p) => ({ ...p, [row.id]: res.data }))
    } catch {
      setPunches((p) => ({ ...p, [row.id]: "error" }))
    }
  }

  const tz = data?.branch.timezone ?? "Asia/Bangkok"
  const complete = data?.rows.filter((r) => r.status === "COMPLETE").length ?? 0

  return (
    <div className="space-y-4">
      <GlassCard padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="attendance-date" className="block text-sm font-medium text-foreground">
              {t("day.date")}
            </label>
            <input
              id="attendance-date"
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="mt-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
            />
          </div>
          {data && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>
                {t("day.present")}: <span className="font-semibold text-foreground">{data.rows.length}</span>
              </span>
              <span>
                {t("day.singlePunchCount")}:{" "}
                <span className="font-semibold text-foreground">{data.rows.length - complete}</span>
              </span>
              <span>
                {t("day.lastSynced")}: {formatDateTime(data.lastSyncedAt, tz, locale)}
              </span>
            </div>
          )}
        </div>
        {data && data.unmappedBadgesToday > 0 && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            {t("day.unmappedWarning", { count: data.unmappedBadgesToday })}{" "}
            <Link href={`/hr/attendance?${new URLSearchParams({ branchId, tab: "badges" })}`} className="underline font-medium">
              {t("day.goMap")}
            </Link>
          </p>
        )}
      </GlassCard>

      <GlassCard padding="none">
        {loading ? (
          <LoadingState title={t("loading")} />
        ) : error ? (
          <ErrorState description={error} onRetry={() => void load()} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={Clock} title={t("day.emptyTitle")} description={t("day.emptyDescription")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                  <th className="p-3 w-8" />
                  <th className="p-3 font-medium">{t("day.person")}</th>
                  <th className="p-3 font-medium">{t("day.badge")}</th>
                  <th className="p-3 font-medium">{t("day.in")}</th>
                  <th className="p-3 font-medium">{t("day.out")}</th>
                  <th className="p-3 font-medium text-right">{t("day.punches")}</th>
                  <th className="p-3 font-medium text-right">{t("day.hours")}</th>
                  <th className="p-3 font-medium">{t("day.status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const detail = punches[row.id]
                  const open = openId === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => void toggle(row)}
                            aria-expanded={open}
                            aria-label={t("day.showPunches")}
                            className="p-1 rounded hover:bg-muted"
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="text-foreground">{row.displayName}</div>
                          <div className="font-mono text-xs text-muted-foreground">{row.rosterNo}</div>
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">{row.badgeNumbers.join(", ") || "—"}</td>
                        <td className="p-3 font-mono">{formatTime(row.firstIn, tz, locale)}</td>
                        <td className="p-3 font-mono">{formatTime(row.lastOut, tz, locale)}</td>
                        <td className="p-3 text-right">{row.punchCount}</td>
                        <td className="p-3 text-right font-mono">{row.status === "COMPLETE" ? formatMinutes(row.workedMinutes) : "—"}</td>
                        <td className="p-3">
                          {row.status === "COMPLETE" ? (
                            <Badge variant="success">{t("status.COMPLETE")}</Badge>
                          ) : (
                            <Badge variant="warning">{t("status.SINGLE_PUNCH")}</Badge>
                          )}
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-border bg-muted/30">
                          <td />
                          <td colSpan={7} className="p-3">
                            {detail === "loading" || detail === undefined ? (
                              <span className="text-muted-foreground">{t("loading")}</span>
                            ) : detail === "error" ? (
                              <span className="text-red-600">{t("day.punchesError")}</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {detail.map((p) => (
                                  <span
                                    key={p.id}
                                    title={`${p.deviceName} · ${p.badgeNumber}`}
                                    className={
                                      p.counted
                                        ? "font-mono text-xs rounded border border-border px-2 py-1 bg-background"
                                        : "font-mono text-xs rounded border border-dashed border-border px-2 py-1 text-muted-foreground line-through"
                                    }
                                  >
                                    {formatTime(p.punchAt, tz, locale)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
