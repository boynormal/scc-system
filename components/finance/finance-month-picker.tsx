"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function currentFinanceMonth(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 7)
}

export function shiftFinanceMonth(month: string, delta: number): string {
  const [year, monthNum] = month.split("-").map(Number)
  if (!year || !monthNum) return month
  const next = new Date(Date.UTC(year, monthNum - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`
}

/** First and last calendar day of `YYYY-MM`. */
export function financeMonthRange(month: string): { dateFrom: string; dateTo: string } {
  const [year, monthNum] = month.split("-").map(Number)
  const last = new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  const mm = pad(monthNum)
  return { dateFrom: `${year}-${mm}-01`, dateTo: `${year}-${mm}-${pad(last)}` }
}

function monthLabel(month: string, locale: string, style: "long" | "short"): string {
  const [year, monthNum] = month.split("-").map(Number)
  return new Date(Date.UTC(year, (monthNum ?? 1) - 1, 1)).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    month: style,
    ...(style === "long" ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  })
}

export function FinanceMonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const locale = useLocale()
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => Number(month.slice(0, 4)))
  const prevLabel = locale === "th" ? "ก่อนหน้า" : "Previous"
  const nextLabel = locale === "th" ? "ถัดไป" : "Next"

  useEffect(() => {
    if (!open) return
    setYear(Number(month.slice(0, 4)))
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
  }, [open, month])

  return (
    <div ref={rootRef} className="relative">
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={prevLabel}
          icon={<ChevronLeft className="h-4 w-4" />}
          className="h-9 w-9 gap-0 border-slate-300 bg-white px-0 text-foreground hover:bg-white dark:border-white/15 dark:bg-slate-950 dark:hover:bg-slate-950"
          onClick={() => onChange(shiftFinanceMonth(month, -1))}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          className="h-9 min-w-[9.5rem] border-slate-300 bg-white px-3 text-sm font-medium text-foreground hover:bg-white dark:border-white/15 dark:bg-slate-950 dark:hover:bg-slate-950"
          onClick={() => setOpen((current) => !current)}
        >
          {monthLabel(month, locale, "long")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={nextLabel}
          icon={<ChevronRight className="h-4 w-4" />}
          className="h-9 w-9 gap-0 border-slate-300 bg-white px-0 text-foreground hover:bg-white dark:border-white/15 dark:bg-slate-950 dark:hover:bg-slate-950"
          onClick={() => onChange(shiftFinanceMonth(month, 1))}
        />
      </div>
      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={monthLabel(month, locale, "long")}
          className="absolute left-0 top-full z-30 mt-1 w-[18rem] rounded-xl border border-border bg-background p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={prevLabel}
              icon={<ChevronLeft className="h-4 w-4" />}
              className="h-8 w-8 gap-0 px-0"
              onClick={() => setYear((current) => current - 1)}
            />
            <span className="text-sm font-medium text-foreground">
              {new Date(Date.UTC(year, 0, 1)).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={nextLabel}
              icon={<ChevronRight className="h-4 w-4" />}
              className="h-8 w-8 gap-0 px-0"
              onClick={() => setYear((current) => current + 1)}
            />
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, index) => {
              const key = `${year}-${pad(index + 1)}`
              const selected = key === month
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key)
                    setOpen(false)
                  }}
                  className={cn(
                    "rounded-md px-2 py-2 text-sm font-medium text-foreground",
                    selected ? "bg-blue-600 text-white" : "hover:bg-muted"
                  )}
                >
                  {monthLabel(key, locale, "short")}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
