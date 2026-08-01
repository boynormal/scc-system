"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Filter } from "lucide-react"
import { GlassButton } from "@/components/glass"
import { transportFilterTriggerClass } from "@/components/transport/toolbar"
import type { JobListGroup } from "@/shared/transport/job-status-groups"

const TERMINAL_GROUPS = new Set<JobListGroup>(["completed", "cancelled"])

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y.slice(2)}`
}

type Props = {
  group: JobListGroup
  /** Effective range shown in summary (URL or server default). */
  effectiveFrom: string
  effectiveTo: string
  /** Default 30-day range used when clearing on terminal tabs. */
  defaultFrom: string
  defaultTo: string
}

export function JobsListFilters({
  group,
  effectiveFrom,
  effectiveTo,
  defaultFrom,
  defaultTo,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filterOpen, setFilterOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(effectiveFrom)
  const [draftTo, setDraftTo] = useState(effectiveTo)
  const [error, setError] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const needsDateHint = TERMINAL_GROUPS.has(group)

  useEffect(() => {
    setDraftFrom(effectiveFrom)
    setDraftTo(effectiveTo)
  }, [effectiveFrom, effectiveTo])

  useEffect(() => {
    if (!filterOpen) return
    const onDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [filterOpen])

  const openFilterPopup = () => {
    setDraftFrom(effectiveFrom)
    setDraftTo(effectiveTo)
    setError(null)
    setFilterOpen((o) => !o)
  }

  const pushParams = (nextFrom: string, nextTo: string) => {
    const q = new URLSearchParams(searchParams.toString())
    q.delete("page")
    if (nextFrom) q.set("from", nextFrom)
    else q.delete("from")
    if (nextTo) q.set("to", nextTo)
    else q.delete("to")
    const s = q.toString()
    router.push(s ? `${pathname}?${s}` : pathname)
  }

  const applyFilters = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setError("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด")
      return
    }
    setError(null)
    pushParams(draftFrom, draftTo)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    setError(null)
    if (needsDateHint) {
      setDraftFrom(defaultFrom)
      setDraftTo(defaultTo)
      pushParams(defaultFrom, defaultTo)
    } else {
      setDraftFrom("")
      setDraftTo("")
      pushParams("", "")
    }
    setFilterOpen(false)
  }

  const filterSummary = (() => {
    if (effectiveFrom && effectiveTo) {
      return `${formatYmdShort(effectiveFrom)}–${formatYmdShort(effectiveTo)}`
    }
    if (effectiveFrom) return `ตั้งแต่ ${formatYmdShort(effectiveFrom)}`
    if (effectiveTo) return `ถึง ${formatYmdShort(effectiveTo)}`
    return needsDateHint ? "ไม่จำกัดวัน" : "ไม่จำกัดวัน"
  })()

  return (
    <div className="relative" ref={popupRef}>
      <button
        type="button"
        onClick={openFilterPopup}
        className={transportFilterTriggerClass(filterOpen)}
      >
        <Filter className="h-3.5 w-3.5" />
        ตัวกรอง
        <span className="hidden text-xs opacity-80 sm:inline">· {filterSummary}</span>
      </button>

      {filterOpen && (
        <div className="absolute left-0 z-30 mt-2 w-[min(100vw-2rem,320px)] rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-foreground">ตัวกรองเพิ่มเติม</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">จากวันที่</label>
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">ถึงวันที่</label>
                <input
                  type="date"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            {needsDateHint ? (
              <p className="text-[11px] text-muted-foreground">
                แท็บเสร็จสิ้น/ยกเลิกจำกัดช่วงเวลา (ค่าเริ่มต้น 30 วันล่าสุด) — ใบงานใหม่ไม่ใช้เงื่อนไขนี้
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                ช่วงวันที่มีผลเฉพาะแท็บใบงานเสร็จสิ้นและยกเลิก
              </p>
            )}
            {error && (
              <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                ล้าง
              </button>
              <GlassButton onClick={applyFilters}>ใช้ตัวกรอง</GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
