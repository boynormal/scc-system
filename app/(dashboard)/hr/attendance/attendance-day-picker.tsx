"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { fetchJson } from "@/lib/client-fetch"
import { cn } from "@/lib/utils"
import { dataPanelClassName } from "@/components/shell/data-panel"
import { Button } from "@/components/ui/button"
import {
  buildMonthCells,
  monthKeyOf,
  shiftDateKey,
  shiftMonthKey,
  sumPresentByMonth,
  type DayPresent,
} from "@/modules/hr/application/attendance-day-calendar"

const fieldButtonClass =
  "h-9 border-slate-300 bg-white text-foreground shadow-sm hover:bg-muted dark:border-white/30 dark:bg-slate-950"

function utcDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1))
}

function formatDayLabel(dateKey: string, locale: string): string {
  return utcDate(dateKey).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatMonthLabel(month: string, locale: string): string {
  return utcDate(`${month}-01`).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

function formatMonthChip(month: string, locale: string, withYear: boolean): string {
  return utcDate(`${month}-01`).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  })
}

function clampMonth(month: string, todayMonth: string): string {
  return month > todayMonth ? todayMonth : month
}

export function AttendanceDayPicker({
  branchId,
  date,
  today,
  onChange,
}: {
  branchId: string
  date: string
  today: string
  onChange: (date: string) => void
}) {
  const t = useTranslations("attendance")
  const locale = useLocale()
  const rootRef = useRef<HTMLDivElement>(null)
  const countsCache = useRef<{ branchId: string; byDate: Map<string, number> } | null>(null)
  const dialogId = useId()
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => clampMonth(monthKeyOf(date), monthKeyOf(today)))
  const [counts, setCounts] = useState<{ branchId: string; byDate: Map<string, number> | null } | null>(null)

  const todayMonth = monthKeyOf(today)
  const weekdays = t.raw("day.weekdays") as string[]
  const loaded = counts?.branchId === branchId ? counts.byDate : undefined
  const months = loaded ? sumPresentByMonth([...loaded.entries()].map(([day, present]) => ({ date: day, present }))) : []
  const multiYear = new Set(months.map((month) => month.month.slice(0, 4))).size > 1

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const cached = countsCache.current
    if (cached?.branchId === branchId) {
      setCounts(cached)
      return
    }
    let cancelled = false
    void fetchJson<{ data: { days: DayPresent[] } }>(
      `/api/hr/attendance/days/counts?${new URLSearchParams({ branchId })}`
    )
      .then((res) => {
        if (cancelled) return
        const byDate = new Map<string, number>()
        for (const day of res.data.days) byDate.set(day.date, day.present)
        const next = { branchId, byDate }
        countsCache.current = next
        setCounts(next)
      })
      .catch(() => {
        if (!cancelled) setCounts({ branchId, byDate: null })
      })
    return () => {
      cancelled = true
    }
  }, [open, branchId])

  function showCalendar() {
    setVisibleMonth(clampMonth(monthKeyOf(date), todayMonth))
    setOpen((current) => !current)
  }

  const cells = buildMonthCells(visibleMonth)

  return (
    <div ref={rootRef} className="relative">
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("day.prevDay")}
          icon={<ChevronLeft className="h-4 w-4" />}
          className={cn(fieldButtonClass, "w-9 gap-0 px-0 py-0")}
          onClick={() => onChange(shiftDateKey(date, -1))}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          className={cn(fieldButtonClass, "min-w-[9.5rem] px-3 py-0 text-sm font-medium")}
          onClick={showCalendar}
        >
          {formatDayLabel(date, locale)}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("day.nextDay")}
          icon={<ChevronRight className="h-4 w-4" />}
          disabled={date >= today}
          className={cn(fieldButtonClass, "w-9 gap-0 px-0 py-0")}
          onClick={() => onChange(shiftDateKey(date, 1))}
        />
      </div>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={t("day.pickDate")}
          className={cn(dataPanelClassName, "absolute left-0 top-full z-30 mt-1 w-[20rem] p-3")}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("day.prevMonth")}
              icon={<ChevronLeft className="h-4 w-4" />}
              className="h-8 w-8 gap-0 px-0 text-foreground"
              onClick={() => setVisibleMonth((month) => shiftMonthKey(month, -1))}
            />
            <span className="text-sm font-medium text-foreground">{formatMonthLabel(visibleMonth, locale)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("day.nextMonth")}
              icon={<ChevronRight className="h-4 w-4" />}
              disabled={visibleMonth >= todayMonth}
              className="h-8 w-8 gap-0 px-0 text-foreground"
              onClick={() => setVisibleMonth((month) => clampMonth(shiftMonthKey(month, 1), todayMonth))}
            />
          </div>
          {months.length > 0 && (
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
              {months.map((month) => (
                <button
                  key={month.month}
                  type="button"
                  onClick={() => setVisibleMonth(clampMonth(month.month, todayMonth))}
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium text-foreground",
                    month.month === visibleMonth
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-border bg-background"
                  )}
                >
                  {formatMonthChip(month.month, locale, multiYear)} {month.total}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {weekdays.map((label) => (
              <div key={label} className="py-1 text-xs font-medium text-foreground">
                {label}
              </div>
            ))}
            {cells.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} />
              const future = day > today
              const selected = day === date
              const isToday = day === today
              const present = loaded?.get(day)
              const empty = loaded != null && present == null
              return (
                <button
                  key={day}
                  type="button"
                  disabled={future}
                  onClick={() => {
                    onChange(day)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center rounded-md text-sm",
                    selected && "bg-blue-600 text-white",
                    !selected && isToday && "text-foreground ring-1 ring-blue-600",
                    !selected && !future && empty && "text-muted-foreground hover:bg-muted",
                    !selected && !future && !empty && "text-foreground hover:bg-muted",
                    future && "cursor-not-allowed text-muted-foreground"
                  )}
                >
                  <span className="font-medium leading-none">{Number(day.slice(8))}</span>
                  {present != null && present > 0 && (
                    <span className={cn("mt-0.5 text-[10px] tabular-nums leading-none", selected ? "text-white" : "text-foreground")}>
                      {present}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
