"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Loader2,
  RefreshCw,
  Wrench,
  Play,
  CheckCircle2,
  XCircle,
  Plus,
  Filter,
  Pencil,
} from "lucide-react"
import { GlassButton, GlassCard } from "@/components/glass"
import { RepairStatusBadge, type RepairStatus } from "@/components/transport/repairs/RepairStatusBadge"
import { ReportRepairModal } from "@/components/transport/repairs/ReportRepairModal"
import { EditRepairModal } from "@/components/transport/repairs/EditRepairModal"
import { cn } from "@/lib/utils"

type RepairRow = {
  id: string
  symptom: string
  notes: string | null
  status: RepairStatus
  reportedAt: string
  startedAt: string | null
  closedAt: string | null
  repairCost: string | number | null
  vehicle: {
    id: string
    plateNumber: string
    name: string
    vehicleType: string
    currentStatus: string
  }
  branch: { id: string; name: string }
  reportedBy?: { firstName: string; lastName: string } | null
}

type StatusFilter = "open" | "all" | RepairStatus

type VehicleOption = {
  id: string
  plateNumber: string
  name: string
}

type ListMeta = {
  total: number
  take: number
  truncated: boolean
}

const NEEDS_DATE_DEFAULT = new Set<StatusFilter>(["closed", "cancelled", "all"])

function formatBangkokYmd(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function lastNDaysRange(days: number): { from: string; to: string } {
  const to = formatBangkokYmd()
  const n = Math.max(1, days)
  const anchor = new Date(`${to}T12:00:00+07:00`)
  const fromDate = new Date(anchor.getTime() - (n - 1) * 24 * 60 * 60 * 1000)
  return { from: formatBangkokYmd(fromDate), to }
}

function formatDt(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
}

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split("-")
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y.slice(2)}`
}

function formatCostDisplay(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—"
  const n = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(n)) return "—"
  return n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function RepairsPageClient() {
  const [items, setItems] = useState<RepairRow[]>([])
  const [meta, setMeta] = useState<ListMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>("open")

  const defaultRange = useMemo(() => lastNDaysRange(30), [])
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [vehicleFilter, setVehicleFilter] = useState("")
  /** draft values inside popup before Apply */
  const [draftFrom, setDraftFrom] = useState("")
  const [draftTo, setDraftTo] = useState("")
  const [draftVehicle, setDraftVehicle] = useState("")
  const [filterOpen, setFilterOpen] = useState(false)

  const [vehicles, setVehicles] = useState<VehicleOption[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [editingRepair, setEditingRepair] = useState<RepairRow | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const effectiveFrom = NEEDS_DATE_DEFAULT.has(filter) ? fromDate || defaultRange.from : fromDate
  const effectiveTo = NEEDS_DATE_DEFAULT.has(filter) ? toDate || defaultRange.to : toDate

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (filter === "open") qs.set("statusGroup", "open")
      else if (filter !== "all") qs.set("status", filter)
      if (vehicleFilter) qs.set("vehicleId", vehicleFilter)
      if (effectiveFrom) qs.set("from", effectiveFrom)
      if (effectiveTo) qs.set("to", effectiveTo)

      const res = await fetch(`/api/transport/repairs?${qs.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "โหลดใบแจ้งซ่อมไม่สำเร็จ")
        return
      }
      setItems(json.data ?? [])
      setMeta(json.meta ?? null)
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setLoading(false)
    }
  }, [filter, vehicleFilter, effectiveFrom, effectiveTo])

  const loadVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/transport/vehicles")
      const json = await res.json()
      if (!res.ok) return
      const list = (json.data ?? []) as VehicleOption[]
      setVehicles([...list].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, "th")))
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

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
    setDraftVehicle(vehicleFilter)
    setFilterOpen((o) => !o)
  }

  const applyFilters = () => {
    if (draftFrom && draftTo && draftFrom > draftTo) {
      setActionError("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด")
      return
    }
    setActionError(null)
    setFromDate(draftFrom)
    setToDate(draftTo)
    setVehicleFilter(draftVehicle)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    if (NEEDS_DATE_DEFAULT.has(filter)) {
      setDraftFrom(defaultRange.from)
      setDraftTo(defaultRange.to)
      setFromDate(defaultRange.from)
      setToDate(defaultRange.to)
    } else {
      setDraftFrom("")
      setDraftTo("")
      setFromDate("")
      setToDate("")
    }
    setDraftVehicle("")
    setVehicleFilter("")
    setFilterOpen(false)
  }

  const changeStatus = (next: StatusFilter) => {
    setFilter(next)
    if (NEEDS_DATE_DEFAULT.has(next) && !fromDate && !toDate) {
      setFromDate(defaultRange.from)
      setToDate(defaultRange.to)
    }
    if (!NEEDS_DATE_DEFAULT.has(next)) {
      // keep dates if user set them; optional clear not required
    }
  }

  const runAction = async (id: string, action: "start" | "close" | "cancel") => {
    setActionId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/transport/repairs/${id}/${action}`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error ?? "ดำเนินการไม่สำเร็จ")
        return
      }
      await load()
    } catch {
      setActionError("เกิดข้อผิดพลาดในการเชื่อมต่อ")
    } finally {
      setActionId(null)
    }
  }

  const selectedVehicle = vehicles.find((v) => v.id === vehicleFilter)

  const filterSummary = (() => {
    const parts: string[] = []
    if (effectiveFrom && effectiveTo) {
      parts.push(`${formatYmdShort(effectiveFrom)}–${formatYmdShort(effectiveTo)}`)
    } else if (effectiveFrom) {
      parts.push(`ตั้งแต่ ${formatYmdShort(effectiveFrom)}`)
    } else if (effectiveTo) {
      parts.push(`ถึง ${formatYmdShort(effectiveTo)}`)
    } else {
      parts.push("ไม่จำกัดวัน")
    }
    parts.push(selectedVehicle ? selectedVehicle.plateNumber : "ทุกคัน")
    return parts.join(" · ")
  })()

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "open", label: "เปิดอยู่" },
    { key: "reported", label: "แจ้งซ่อม" },
    { key: "in_repair", label: "กำลังซ่อม" },
    { key: "closed", label: "ปิดงาน" },
    { key: "cancelled", label: "ยกเลิก" },
    { key: "all", label: "ทั้งหมด" },
  ]

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">ใบแจ้งซ่อมรถ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            แจ้งซ่อม → เข้าซ่อม (รถเป็นซ่อมบำรุง) → ปิดงาน (รถกลับพร้อมใช้งาน)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            title="รีเฟรช"
            aria-label="รีเฟรช"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
          <GlassButton onClick={() => setReportOpen(true)} icon={<Plus className="h-4 w-4" />}>
            แจ้งซ่อม
          </GlassButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => changeStatus(f.key)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative" ref={popupRef}>
          <button
            type="button"
            onClick={openFilterPopup}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              filterOpen
                ? "border-cyan-500 bg-cyan-50 text-cyan-800"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
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
                {NEEDS_DATE_DEFAULT.has(filter) && (
                  <p className="text-[11px] text-muted-foreground">
                    แท็บนี้แนะนำจำกัดช่วงเวลา (ค่าเริ่มต้น 30 วันล่าสุด)
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">รถ</label>
                  <select
                    value={draftVehicle}
                    onChange={(e) => setDraftVehicle(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">ทุกคัน</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plateNumber} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>
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
      </div>

      <p className="text-xs text-muted-foreground sm:hidden">{filterSummary}</p>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {meta?.truncated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          แสดง {items.length} จากทั้งหมด {meta.total} รายการ — จำกัดช่วงเวลาหรือกรองรถเพื่อดูครบ
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="p-8 text-center text-sm text-muted-foreground">
          ไม่มีใบแจ้งซ่อมในตัวกรองนี้ — กด &quot;แจ้งซ่อม&quot; เพื่อสร้างใบใหม่ หรือปรับช่วงเวลา
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <GlassCard key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {item.vehicle.plateNumber}
                    </span>
                    <span className="text-sm text-muted-foreground">{item.vehicle.name}</span>
                    <RepairStatusBadge status={item.status} />
                  </div>
                  <p className="text-sm text-foreground">{item.symptom}</p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    {item.branch.name} · แจ้งเมื่อ {formatDt(item.reportedAt)}
                    {item.reportedBy
                      ? ` · โดย ${item.reportedBy.firstName} ${item.reportedBy.lastName}`
                      : ""}
                    {` · ราคา ${formatCostDisplay(item.repairCost)} บาท`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRepair(item)}
                    disabled={actionId === item.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    แก้ไข
                  </button>
                  {item.status === "reported" && (
                    <>
                      <GlassButton
                        onClick={() => runAction(item.id, "start")}
                        disabled={actionId === item.id}
                        icon={
                          actionId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )
                        }
                      >
                        เข้าซ่อม
                      </GlassButton>
                      <button
                        type="button"
                        onClick={() => runAction(item.id, "cancel")}
                        disabled={actionId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                      >
                        <XCircle className="h-4 w-4" />
                        ยกเลิก
                      </button>
                    </>
                  )}
                  {item.status === "in_repair" && (
                    <GlassButton
                      onClick={() => runAction(item.id, "close")}
                      disabled={actionId === item.id}
                      icon={
                        actionId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )
                      }
                    >
                      ปิดงานซ่อม
                    </GlassButton>
                  )}
                  {(item.status === "closed" || item.status === "cancelled") && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Wrench className="h-3.5 w-3.5" />
                      {item.status === "closed" ? `ปิดเมื่อ ${formatDt(item.closedAt)}` : "ยกเลิกแล้ว"}
                    </span>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <ReportRepairModal
        open={reportOpen}
        onSuccess={() => {
          setReportOpen(false)
          if (filter === "open") {
            load()
          } else {
            setFilter("open")
          }
        }}
        onCancel={() => setReportOpen(false)}
      />

      <EditRepairModal
        open={!!editingRepair}
        repair={editingRepair}
        onSuccess={() => {
          setEditingRepair(null)
          load()
        }}
        onCancel={() => setEditingRepair(null)}
      />
    </div>
  )
}
